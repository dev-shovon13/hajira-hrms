import { Router } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { validate } from '@/middleware/validate';
import { authenticate, authorize } from '@/middleware/auth';
import { avatarUpload } from '@/lib/upload';
import {
  approveAccountSchema,
  inviteUserSchema,
  optionsQuery,
  rejectSchema,
  updateProfileSchema,
  updateUserSchema,
  userListQuery,
} from './schema';
import * as c from './controller';

export const userRoutes = Router();

userRoutes.use(authenticate);

// Self-service
userRoutes.get('/me', asyncHandler(c.profile));
userRoutes.patch('/me', validate({ body: updateProfileSchema }), asyncHandler(c.updateProfile));
userRoutes.post('/me/avatar', avatarUpload, asyncHandler(c.uploadAvatar));

// Directory
userRoutes.get('/', authorize('HR', 'MANAGER'), validate({ query: userListQuery }), asyncHandler(c.list));
userRoutes.get('/options', authorize('HR', 'MANAGER'), validate({ query: optionsQuery }), asyncHandler(c.options));
userRoutes.get('/:id', asyncHandler(c.getOne));

// HR / Admin
userRoutes.post('/invite', authorize('HR'), validate({ body: inviteUserSchema }), asyncHandler(c.invite));
userRoutes.post('/:id/resend-invite', authorize('HR'), asyncHandler(c.resendInvite));
userRoutes.post('/:id/approve', authorize('HR'), validate({ body: approveAccountSchema }), asyncHandler(c.approve));
userRoutes.post('/:id/reject', authorize('HR'), validate({ body: rejectSchema }), asyncHandler(c.reject));
userRoutes.patch('/:id', authorize('HR'), validate({ body: updateUserSchema }), asyncHandler(c.update));
userRoutes.delete('/:id', authorize('HR'), asyncHandler(c.remove));
