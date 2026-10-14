import type { Prisma, Role } from '@prisma/client';
import type {
  ApproveAccountInput,
  InviteUserInput,
  UpdateProfileInput,
  UpdateUserInput,
  UserDetail,
  UserRow,
} from '@hajira/shared';
import type { z } from 'zod';
import type { userListQuery } from '@hajira/shared';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';
import { notify } from '@/lib/notify';
import { sendMail } from '@/lib/mailer';
import { emails } from '@/emails/templates';
import { AppError } from '@/utils/AppError';
import { pageArgs } from '@/utils/response';
import { dateStr, dbDate } from '@/lib/time';
import { shiftFor, toShiftDto } from '@/lib/schedule';
import { issueToken } from '@/modules/auth/service';
import { ensureBalances } from '@/modules/leave/balances';
import { isHrOrAdmin } from '@/middleware/auth';

type Actor = Express.AuthUser;

export const rowSelect = {
  id: true,
  employeeCode: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  avatarUrl: true,
  joinDate: true,
  emailVerifiedAt: true,
  createdAt: true,
  department: { select: { id: true, name: true } },
  designation: { select: { id: true, title: true } },
  manager: { select: { id: true, name: true } },
} satisfies Prisma.UserSelect;

type Row = Prisma.UserGetPayload<{ select: typeof rowSelect }>;

export const toRow = (u: Row): UserRow => ({
  id: u.id,
  employeeCode: u.employeeCode,
  name: u.name,
  email: u.email,
  phone: u.phone,
  role: u.role,
  status: u.status,
  avatarUrl: u.avatarUrl,
  joinDate: u.joinDate ? dateStr(u.joinDate) : null,
  emailVerified: Boolean(u.emailVerifiedAt),
  department: u.department,
  designation: u.designation,
  manager: u.manager,
  createdAt: u.createdAt.toISOString(),
});

/** Scope rule: HR/Admin see everyone; managers see their direct reports; others see themselves. */
export function visibleUsersWhere(actor: Actor): Prisma.UserWhereInput {
  if (isHrOrAdmin(actor.role)) return { deletedAt: null };
  if (actor.role === 'MANAGER') return { deletedAt: null, OR: [{ managerId: actor.id }, { id: actor.id }] };
  return { deletedAt: null, id: actor.id };
}

const SORT: Record<string, (o: Prisma.SortOrder) => Prisma.UserOrderByWithRelationInput> = {
  name: (o) => ({ name: o }),
  email: (o) => ({ email: o }),
  employeeCode: (o) => ({ employeeCode: o }),
  role: (o) => ({ role: o }),
  status: (o) => ({ status: o }),
  joinDate: (o) => ({ joinDate: o }),
  createdAt: (o) => ({ createdAt: o }),
  department: (o) => ({ department: { name: o } }),
};

export async function list(actor: Actor, q: z.infer<typeof userListQuery>) {
  const where: Prisma.UserWhereInput = {
    AND: [
      visibleUsersWhere(actor),
      q.status ? { status: q.status } : {},
      q.role ? { role: q.role } : {},
      q.departmentId ? { departmentId: q.departmentId } : {},
      q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: 'insensitive' } },
              { email: { contains: q.search, mode: 'insensitive' } },
              { employeeCode: { contains: q.search, mode: 'insensitive' } },
              { phone: { contains: q.search } },
            ],
          }
        : {},
    ],
  };
  const orderBy = (SORT[q.sort ?? ''] ?? SORT.name)(q.sort ? q.order : 'asc');
  const [rows, total] = await Promise.all([
    prisma.user.findMany({ where, select: rowSelect, orderBy, ...pageArgs(q) }),
    prisma.user.count({ where }),
  ]);
  return { rows: rows.map(toRow), total };
}

/** Active people for pickers (manager, department head, assignees). */
export function options(role?: Role[]) {
  return prisma.user.findMany({
    where: { deletedAt: null, status: 'ACTIVE', ...(role ? { role: { in: role } } : {}) },
    select: { id: true, name: true, role: true, avatarUrl: true, departmentId: true, employeeCode: true },
    orderBy: { name: 'asc' },
  });
}

export async function getById(actor: Actor, id: string): Promise<UserDetail> {
  const user = await prisma.user.findFirst({
    where: { AND: [visibleUsersWhere(actor), { id }] },
    select: { ...rowSelect, address: true, emergencyContact: true, dateOfBirth: true, isSuperAdmin: true, lastLoginAt: true },
  });
  if (!user) throw AppError.notFound('Employee');
  const today = new Date().toISOString().slice(0, 10);
  const shift = await shiftFor(id, today);
  return {
    ...toRow(user),
    address: user.address,
    emergencyContact: user.emergencyContact,
    dateOfBirth: user.dateOfBirth ? dateStr(user.dateOfBirth) : null,
    isSuperAdmin: user.isSuperAdmin,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    currentShift: toShiftDto(shift),
  };
}

export async function nextEmployeeCode(db: Prisma.TransactionClient | typeof prisma = prisma) {
  const last = await db.user.findFirst({
    where: { employeeCode: { startsWith: 'HJ-' } },
    orderBy: { employeeCode: 'desc' },
    select: { employeeCode: true },
  });
  const n = last?.employeeCode ? Number(last.employeeCode.slice(3)) + 1 : 1;
  return `HJ-${String(n).padStart(4, '0')}`;
}

async function assignInitialShift(userId: string, shiftId: string | null | undefined, from: string) {
  if (!shiftId) return;
  const shift = await prisma.shift.findFirst({ where: { id: shiftId, isActive: true } });
  if (!shift) throw AppError.badRequest('Choose a valid shift', 'BAD_SHIFT');
  await prisma.employeeShift.create({ data: { userId, shiftId, effectiveFrom: dbDate(from) } });
}

function guardRoleChange(actor: Actor, targetRole: Role | undefined) {
  if (targetRole === 'ADMIN' && actor.role !== 'ADMIN') {
    throw AppError.forbidden('Only an admin can grant the admin role', 'ADMIN_ONLY');
  }
}

export async function invite(actor: Actor, input: InviteUserInput, ip?: string) {
  guardRoleChange(actor, input.role);
  const exists = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (exists) throw AppError.conflict('Someone with this email already has an account', 'EMAIL_TAKEN');

  const today = new Date().toISOString().slice(0, 10);
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone || null,
      role: input.role,
      status: 'INVITED',
      departmentId: input.departmentId,
      designationId: input.designationId,
      managerId: input.managerId || null,
      employeeCode: await nextEmployeeCode(),
      joinDate: dbDate(today),
    },
    select: rowSelect,
  });
  await assignInitialShift(user.id, input.shiftId, today);
  await ensureBalances(user.id, new Date().getFullYear());

  const token = await issueToken(user.id, 'INVITE');
  sendMail(emails.invite(user.email, user.name, actor.name, token));
  await audit({ actorId: actor.id, action: 'user.invite', entity: 'User', entityId: user.id, after: input, ip });
  return toRow(user);
}

export async function resendInvite(actor: Actor, id: string) {
  const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!user) throw AppError.notFound('Employee');
  if (user.status !== 'INVITED') throw AppError.conflict('This person already activated their account', 'NOT_INVITED');
  const token = await issueToken(user.id, 'INVITE');
  sendMail(emails.invite(user.email, user.name, actor.name, token));
}

export async function approve(actor: Actor, id: string, input: ApproveAccountInput, ip?: string) {
  guardRoleChange(actor, input.role);
  const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!user) throw AppError.notFound('Employee');
  if (user.status !== 'PENDING') throw AppError.conflict('This account is not waiting for approval', 'NOT_PENDING');

  const today = new Date().toISOString().slice(0, 10);
  const updated = await prisma.user.update({
    where: { id },
    data: {
      status: 'ACTIVE',
      role: input.role,
      managerId: input.managerId || null,
      employeeCode: user.employeeCode ?? (await nextEmployeeCode()),
      joinDate: user.joinDate ?? dbDate(today),
    },
    select: rowSelect,
  });
  await assignInitialShift(id, input.shiftId, today);
  await ensureBalances(id, new Date().getFullYear());

  await notify({
    userId: id,
    type: 'ACCOUNT_APPROVAL',
    title: 'Your account is approved',
    body: 'Welcome to Hajira. You can check in from today.',
    link: '/dashboard',
    email: emails.accountApproved(user.email, user.name),
  });
  await audit({ actorId: actor.id, action: 'user.approve', entity: 'User', entityId: id, before: { status: user.status, role: user.role }, after: input, ip });
  return toRow(updated);
}

export async function reject(actor: Actor, id: string, comment: string, ip?: string) {
  const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!user) throw AppError.notFound('Employee');
  if (user.status !== 'PENDING') throw AppError.conflict('This account is not waiting for approval', 'NOT_PENDING');
  await prisma.user.update({ where: { id }, data: { status: 'REJECTED' } });
  sendMail(emails.accountRejected(user.email, user.name, comment));
  await audit({ actorId: actor.id, action: 'user.reject', entity: 'User', entityId: id, after: { comment }, ip });
}

export async function update(actor: Actor, id: string, input: UpdateUserInput, ip?: string) {
  const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!user) throw AppError.notFound('Employee');
  if (user.role === 'ADMIN' && actor.role !== 'ADMIN') throw AppError.forbidden('Only an admin can edit an admin', 'ADMIN_ONLY');
  if (user.isSuperAdmin && input.role && input.role !== 'ADMIN') {
    throw AppError.forbidden('The super admin always keeps the admin role', 'SUPER_ADMIN');
  }
  if (user.isSuperAdmin && input.status && input.status !== 'ACTIVE') {
    throw AppError.forbidden('The super admin cannot be suspended', 'SUPER_ADMIN');
  }
  if (id === actor.id && input.role && input.role !== user.role) {
    throw AppError.forbidden('You cannot change your own role', 'SELF_ROLE');
  }
  if (input.managerId === id) throw AppError.badRequest('An employee cannot report to themselves', 'SELF_MANAGER');
  guardRoleChange(actor, input.role);

  const updated = await prisma.user.update({
    where: { id },
    data: {
      name: input.name,
      phone: input.phone,
      role: input.role,
      status: input.status,
      departmentId: input.departmentId,
      designationId: input.designationId,
      managerId: input.managerId === undefined ? undefined : input.managerId || null,
      joinDate: input.joinDate ? dbDate(input.joinDate) : undefined,
    },
    select: rowSelect,
  });

  if (input.status === 'SUSPENDED') {
    await prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
  }
  const roleChanged = input.role && input.role !== user.role;
  await audit({
    actorId: actor.id,
    action: roleChanged ? 'user.role_change' : 'user.update',
    entity: 'User',
    entityId: id,
    before: { role: user.role, status: user.status, departmentId: user.departmentId, designationId: user.designationId, managerId: user.managerId },
    after: input,
    ip,
  });
  return toRow(updated);
}

export async function remove(actor: Actor, id: string, ip?: string) {
  const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!user) throw AppError.notFound('Employee');
  if (id === actor.id) throw AppError.forbidden('You cannot delete your own account', 'SELF_DELETE');
  if (user.isSuperAdmin) throw AppError.forbidden('The super admin cannot be deleted', 'SUPER_ADMIN');
  if (user.role === 'ADMIN' && actor.role !== 'ADMIN') throw AppError.forbidden('Only an admin can remove an admin', 'ADMIN_ONLY');

  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { deletedAt: new Date(), status: 'SUSPENDED' } }),
    prisma.user.updateMany({ where: { managerId: id }, data: { managerId: null } }),
    prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  await audit({ actorId: actor.id, action: 'user.delete', entity: 'User', entityId: id, before: { name: user.name, email: user.email, role: user.role }, ip });
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      name: input.name,
      phone: input.phone,
      address: input.address || null,
      emergencyContact: input.emergencyContact || null,
      dateOfBirth: input.dateOfBirth ? dbDate(input.dateOfBirth) : null,
    },
  });
}

export async function setAvatar(userId: string, url: string) {
  await prisma.user.update({ where: { id: userId }, data: { avatarUrl: url } });
}
