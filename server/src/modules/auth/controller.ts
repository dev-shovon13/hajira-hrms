import type { Request, Response } from 'express';
import {
  acceptInviteSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '@hajira/shared';
import { vb } from '@/middleware/validate';
import { me } from '@/middleware/auth';
import { ok, created } from '@/utils/response';
import { REFRESH_COOKIE, clearAuthCookies, setAuthCookies } from '@/lib/tokens';
import * as service from './service';

const meta = (req: Request) => ({ ip: req.ip, userAgent: req.get('user-agent') });

export async function register(req: Request, res: Response) {
  const data = await service.register(vb(req, registerSchema), meta(req));
  created(res, data, 'Account created. Check your email to confirm it; HR will then approve your account.');
}

export async function login(req: Request, res: Response) {
  const { session, user } = await service.login(vb(req, loginSchema), meta(req));
  setAuthCookies(res, session);
  ok(res, user, `Welcome back, ${user.name.split(' ')[0]}`);
}

export async function refresh(req: Request, res: Response) {
  try {
    const session = await service.refresh(req.cookies?.[REFRESH_COOKIE], meta(req));
    setAuthCookies(res, session);
    ok(res, { role: session.role }, 'Session refreshed');
  } catch (err) {
    clearAuthCookies(res);
    throw err;
  }
}

export async function logout(req: Request, res: Response) {
  await service.logout(req.cookies?.[REFRESH_COOKIE]);
  clearAuthCookies(res);
  ok(res, null, 'Signed out');
}

export async function currentUser(req: Request, res: Response) {
  ok(res, await service.toSessionUser(me(req).id));
}

export async function verifyEmail(req: Request, res: Response) {
  const data = await service.verifyEmail(vb(req, verifyEmailSchema).token);
  ok(
    res,
    data,
    data.status === 'ACTIVE' ? 'Email confirmed. You can sign in.' : 'Email confirmed. HR will review your account shortly.',
  );
}

export async function resendVerification(req: Request, res: Response) {
  await service.resendVerification(vb(req, forgotPasswordSchema).email);
  ok(res, null, 'If that account needs confirming, a new link is on its way.');
}

export async function forgotPassword(req: Request, res: Response) {
  await service.forgotPassword(vb(req, forgotPasswordSchema).email);
  ok(res, null, 'If an account exists for that email, a reset link is on its way. It expires in 15 minutes.');
}

export async function resetPassword(req: Request, res: Response) {
  await service.resetPassword(vb(req, resetPasswordSchema), meta(req));
  clearAuthCookies(res);
  ok(res, null, 'Password updated. Sign in with your new password.');
}

export async function acceptInvite(req: Request, res: Response) {
  const { session, user } = await service.acceptInvite(vb(req, acceptInviteSchema), meta(req));
  setAuthCookies(res, session);
  ok(res, user, `Welcome to Hajira, ${user.name.split(' ')[0]}`);
}

export async function changePassword(req: Request, res: Response) {
  await service.changePassword(me(req).id, vb(req, changePasswordSchema), req.cookies?.[REFRESH_COOKIE], meta(req));
  ok(res, null, 'Password changed. Other devices were signed out.');
}
