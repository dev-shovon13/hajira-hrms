import { Router } from 'express';
import {
  acceptInviteSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '@hajira/shared';
import { asyncHandler } from '@/utils/asyncHandler';
import { validate } from '@/middleware/validate';
import { authenticate } from '@/middleware/auth';
import { forgotPasswordLimiter, loginLimiter, registerLimiter, sensitiveLimiter } from '@/middleware/rateLimit';
import * as c from './controller';

export const authRoutes = Router();

authRoutes.post('/register', registerLimiter, validate({ body: registerSchema }), asyncHandler(c.register));
authRoutes.post('/login', loginLimiter, validate({ body: loginSchema }), asyncHandler(c.login));
authRoutes.post('/refresh', asyncHandler(c.refresh));
authRoutes.post('/logout', asyncHandler(c.logout));
authRoutes.get('/me', authenticate, asyncHandler(c.currentUser));
authRoutes.post('/verify-email', sensitiveLimiter, validate({ body: verifyEmailSchema }), asyncHandler(c.verifyEmail));
authRoutes.post('/resend-verification', forgotPasswordLimiter, validate({ body: forgotPasswordSchema }), asyncHandler(c.resendVerification));
authRoutes.post('/forgot-password', forgotPasswordLimiter, validate({ body: forgotPasswordSchema }), asyncHandler(c.forgotPassword));
authRoutes.post('/reset-password', sensitiveLimiter, validate({ body: resetPasswordSchema }), asyncHandler(c.resetPassword));
authRoutes.post('/accept-invite', sensitiveLimiter, validate({ body: acceptInviteSchema }), asyncHandler(c.acceptInvite));
authRoutes.post('/change-password', authenticate, sensitiveLimiter, validate({ body: changePasswordSchema }), asyncHandler(c.changePassword));
