import argon2 from 'argon2';
import crypto from 'node:crypto';
import type { TokenType, User } from '@prisma/client';
import type {
  AcceptInviteInput,
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  SessionUser,
} from '@hajira/shared';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/utils/AppError';
import {
  randomToken,
  refreshTtlDays,
  sha256,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '@/lib/tokens';
import { emails } from '@/emails/templates';
import { sendMail } from '@/lib/mailer';
import { notifyMany, usersWithRoles } from '@/lib/notify';
import { audit } from '@/lib/audit';

const ARGON = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };
const TOKEN_TTL: Record<TokenType, number> = {
  EMAIL_VERIFY: 24 * 60,
  PASSWORD_RESET: 15,
  INVITE: 7 * 24 * 60,
};
/** Parallel tabs may refresh with the same token; treat reuse inside this window as benign. */
const REUSE_GRACE_MS = 15_000;

export interface SessionMeta {
  ip?: string;
  userAgent?: string;
}

export const hashPassword = (password: string) => argon2.hash(password, ARGON);

// A real hash of a random string, so unknown emails cost the same time as wrong passwords.
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= hashPassword(crypto.randomBytes(16).toString('hex')));

export async function verifyPassword(hash: string | null, password: string) {
  if (!hash) {
    await argon2.verify(await getDummyHash(), password).catch(() => false);
    return false;
  }
  return argon2.verify(hash, password).catch(() => false);
}

export async function issueToken(userId: string, type: TokenType) {
  const token = randomToken();
  // One live token per purpose: older links stop working when a new one is sent.
  await prisma.verificationToken.deleteMany({ where: { userId, type, usedAt: null } });
  await prisma.verificationToken.create({
    data: { userId, type, tokenHash: sha256(token), expiresAt: new Date(Date.now() + TOKEN_TTL[type] * 60_000) },
  });
  return token;
}

async function consumeToken(token: string, type: TokenType) {
  const row = await prisma.verificationToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.type !== type || row.usedAt) {
    throw AppError.badRequest('This link is invalid or has already been used', 'INVALID_LINK');
  }
  if (row.expiresAt < new Date()) throw AppError.badRequest('This link has expired. Request a new one.', 'LINK_EXPIRED');
  await prisma.verificationToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  return row;
}

export async function toSessionUser(userId: string): Promise<SessionUser> {
  const u = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      isSuperAdmin: true,
      avatarUrl: true,
      emailVerifiedAt: true,
      employeeCode: true,
      department: { select: { id: true, name: true } },
      designation: { select: { id: true, title: true } },
      _count: { select: { reports: { where: { deletedAt: null, status: 'ACTIVE' } } } },
    },
  });
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    isSuperAdmin: u.isSuperAdmin,
    avatarUrl: u.avatarUrl,
    emailVerified: Boolean(u.emailVerifiedAt),
    employeeCode: u.employeeCode,
    department: u.department,
    designation: u.designation,
    hasReports: u._count.reports > 0,
  };
}

async function createSession(user: Pick<User, 'id' | 'role'>, remember: boolean, meta: SessionMeta, family?: string) {
  const fam = family ?? crypto.randomUUID();
  const jti = crypto.randomUUID();
  const refresh = signRefreshToken({ sub: user.id, fam, jti }, remember);
  const record = await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(refresh),
      family: fam,
      remember,
      expiresAt: new Date(Date.now() + refreshTtlDays(remember) * 86_400_000),
      ip: meta.ip,
      userAgent: meta.userAgent?.slice(0, 255),
    },
  });
  const access = signAccessToken({ sub: user.id, role: user.role });
  return { access, refresh, remember, role: user.role, recordId: record.id };
}

// ---------- register / verify ----------

export async function register(input: RegisterInput, meta: SessionMeta) {
  const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) throw AppError.conflict('An account with this email already exists', 'EMAIL_TAKEN');

  const [department, designation] = await Promise.all([
    prisma.department.findFirst({ where: { id: input.departmentId, deletedAt: null } }),
    prisma.designation.findUnique({ where: { id: input.designationId } }),
  ]);
  if (!department) throw AppError.badRequest('Choose a valid department', 'BAD_DEPARTMENT');
  if (!designation) throw AppError.badRequest('Choose a valid designation', 'BAD_DESIGNATION');

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone,
      passwordHash: await hashPassword(input.password),
      status: 'PENDING',
      departmentId: department.id,
      designationId: designation.id,
    },
  });

  const token = await issueToken(user.id, 'EMAIL_VERIFY');
  sendMail(emails.verifyEmail(user.email, user.name, token));

  const approvers = await usersWithRoles(['HR', 'ADMIN']);
  await notifyMany(
    approvers.map((a) => ({
      userId: a.id,
      type: 'ACCOUNT_APPROVAL' as const,
      title: 'New account waiting for approval',
      body: `${user.name} (${department.name}) registered and needs approval.`,
      link: '/employees/pending',
    })),
  );
  await audit({ actorId: user.id, action: 'user.register', entity: 'User', entityId: user.id, ip: meta.ip });
  return { email: user.email };
}

export async function verifyEmail(token: string) {
  const row = await consumeToken(token, 'EMAIL_VERIFY');
  const user = await prisma.user.update({
    where: { id: row.userId },
    data: { emailVerifiedAt: new Date() },
    select: { status: true },
  });
  return { status: user.status };
}

export async function resendVerification(email: string) {
  const user = await prisma.user.findFirst({ where: { email, deletedAt: null } });
  // Same response whether or not the account exists.
  if (!user || user.emailVerifiedAt) return;
  const token = await issueToken(user.id, 'EMAIL_VERIFY');
  sendMail(emails.verifyEmail(user.email, user.name, token));
}

// ---------- sessions ----------

export async function login(input: LoginInput, meta: SessionMeta) {
  const user = await prisma.user.findFirst({ where: { email: input.email, deletedAt: null } });
  const valid = await verifyPassword(user?.passwordHash ?? null, input.password);
  if (!user || !valid) throw AppError.unauthorized('Email or password is incorrect', 'INVALID_CREDENTIALS');

  if (!user.emailVerifiedAt) {
    throw AppError.forbidden('Confirm your email first. We sent you a link when you registered.', 'EMAIL_NOT_VERIFIED');
  }
  const blocked: Record<string, [string, string]> = {
    PENDING: ['Your account is waiting for HR approval. We will email you when it is ready.', 'ACCOUNT_PENDING'],
    INVITED: ['Finish setting up your account from the invitation email.', 'ACCOUNT_INVITED'],
    SUSPENDED: ['Your account is suspended. Contact HR.', 'ACCOUNT_SUSPENDED'],
    REJECTED: ['Your registration was not approved. Contact HR.', 'ACCOUNT_REJECTED'],
  };
  if (blocked[user.status]) throw AppError.forbidden(...blocked[user.status]);

  const session = await createSession(user, input.remember, meta);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return { session, user: await toSessionUser(user.id) };
}

export async function refresh(token: string | undefined, meta: SessionMeta) {
  if (!token) throw AppError.unauthorized('Please sign in again', 'NO_REFRESH');
  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw AppError.unauthorized('Please sign in again', 'INVALID_REFRESH');
  }

  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { select: { id: true, role: true, status: true, deletedAt: true } } },
  });
  if (!record) throw AppError.unauthorized('Please sign in again', 'INVALID_REFRESH');

  if (record.revokedAt) {
    const benign = record.replacedById && Date.now() - record.revokedAt.getTime() < REUSE_GRACE_MS;
    if (!benign) {
      // A rotated token came back: assume theft and end every session in this family.
      await prisma.refreshToken.updateMany({
        where: { family: record.family, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw AppError.unauthorized('Please sign in again', 'REFRESH_REUSED');
    }
  }
  if (record.expiresAt < new Date()) throw AppError.unauthorized('Your session expired', 'REFRESH_EXPIRED');
  if (record.user.status !== 'ACTIVE' || record.user.deletedAt) {
    throw AppError.forbidden('Your account is not active', 'ACCOUNT_INACTIVE');
  }

  const session = await createSession(record.user, record.remember, meta, payload.fam);
  if (!record.revokedAt) {
    await prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date(), replacedById: session.recordId },
    });
  }
  return session;
}

export async function logout(token: string | undefined) {
  if (!token) return;
  await prisma.refreshToken.updateMany({
    where: { tokenHash: sha256(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

async function revokeAllSessions(userId: string, exceptHash?: string) {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null, ...(exceptHash ? { tokenHash: { not: exceptHash } } : {}) },
    data: { revokedAt: new Date() },
  });
}

// ---------- passwords ----------

export async function forgotPassword(email: string) {
  const user = await prisma.user.findFirst({ where: { email, deletedAt: null, status: 'ACTIVE' } });
  if (!user) return; // never reveal whether an account exists
  const token = await issueToken(user.id, 'PASSWORD_RESET');
  sendMail(emails.resetPassword(user.email, user.name, token));
}

export async function resetPassword(input: ResetPasswordInput, meta: SessionMeta) {
  const row = await consumeToken(input.token, 'PASSWORD_RESET');
  await prisma.user.update({
    where: { id: row.userId },
    data: { passwordHash: await hashPassword(input.password), emailVerifiedAt: new Date() },
  });
  await revokeAllSessions(row.userId);
  await audit({ actorId: row.userId, action: 'user.password_reset', entity: 'User', entityId: row.userId, ip: meta.ip });
}

export async function acceptInvite(input: AcceptInviteInput, meta: SessionMeta) {
  const row = await consumeToken(input.token, 'INVITE');
  const user = await prisma.user.update({
    where: { id: row.userId },
    data: { passwordHash: await hashPassword(input.password), status: 'ACTIVE', emailVerifiedAt: new Date() },
  });
  await audit({ actorId: user.id, action: 'user.invite_accepted', entity: 'User', entityId: user.id, ip: meta.ip });
  const session = await createSession(user, false, meta);
  return { session, user: await toSessionUser(user.id) };
}

export async function changePassword(userId: string, input: ChangePasswordInput, currentRefresh: string | undefined, meta: SessionMeta) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(user.passwordHash, input.currentPassword))) {
    throw AppError.badRequest('Current password is incorrect', 'WRONG_PASSWORD', {
      currentPassword: ['Current password is incorrect'],
    });
  }
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(input.password) } });
  // Sign out every other device; keep this one.
  await revokeAllSessions(userId, currentRefresh ? sha256(currentRefresh) : undefined);
  await audit({ actorId: userId, action: 'user.password_changed', entity: 'User', entityId: userId, ip: meta.ip });
}
