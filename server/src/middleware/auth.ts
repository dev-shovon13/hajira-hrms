import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ACCESS_COOKIE, verifyAccessToken } from '@/lib/tokens';
import { AppError } from '@/utils/AppError';

function readToken(req: Request) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return req.cookies?.[ACCESS_COOKIE] as string | undefined;
}

/** Requires a valid access token for an ACTIVE, non-deleted user. */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = readToken(req);
    if (!token) throw AppError.unauthorized('Please sign in to continue', 'NO_TOKEN');
    const payload = verifyAccessToken(token);

    // One indexed lookup per request, so role changes and suspensions apply immediately.
    const user = await prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null },
      select: {
        id: true,
        role: true,
        status: true,
        isSuperAdmin: true,
        name: true,
        email: true,
        departmentId: true,
        managerId: true,
      },
    });
    if (!user) throw AppError.unauthorized('Your account no longer exists', 'USER_GONE');
    if (user.status !== 'ACTIVE') throw AppError.forbidden('Your account is not active', 'ACCOUNT_INACTIVE');
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/** Role gate. ADMIN always passes. */
export const authorize =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) return next(AppError.unauthorized());
    if (user.role === 'ADMIN' || roles.includes(user.role)) return next();
    next(AppError.forbidden());
  };

export const isHrOrAdmin = (role: Role) => role === 'HR' || role === 'ADMIN';
export const isApprover = (role: Role) => role === 'MANAGER' || role === 'HR' || role === 'ADMIN';

/** The authenticated user; only call behind authenticate(). */
export function me(req: Request) {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}
