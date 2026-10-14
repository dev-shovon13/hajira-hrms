import type { Request, Response } from 'express';
import {
  approveAccountSchema,
  inviteUserSchema,
  rejectSchema,
  updateProfileSchema,
  updateUserSchema,
  userListQuery,
} from '@hajira/shared';
import { vb, vq } from '@/middleware/validate';
import { me } from '@/middleware/auth';
import { created, ok, paginated } from '@/utils/response';
import { AppError } from '@/utils/AppError';
import { storeFile } from '@/lib/upload';
import { toSessionUser } from '@/modules/auth/service';
import { optionsQuery } from './schema';
import * as service from './service';

export async function list(req: Request, res: Response) {
  const q = vq(req, userListQuery);
  const { rows, total } = await service.list(me(req), q);
  paginated(res, rows, { page: q.page, limit: q.limit, total });
}

export async function options(req: Request, res: Response) {
  const { roles } = vq(req, optionsQuery);
  ok(res, await service.options(roles));
}

export async function getOne(req: Request, res: Response) {
  ok(res, await service.getById(me(req), req.params.id));
}

export async function invite(req: Request, res: Response) {
  const user = await service.invite(me(req), vb(req, inviteUserSchema), req.ip);
  created(res, user, `Invitation sent to ${user.email}`);
}

export async function resendInvite(req: Request, res: Response) {
  await service.resendInvite(me(req), req.params.id);
  ok(res, null, 'Invitation sent again');
}

export async function approve(req: Request, res: Response) {
  const user = await service.approve(me(req), req.params.id, vb(req, approveAccountSchema), req.ip);
  ok(res, user, `${user.name} is approved`);
}

export async function reject(req: Request, res: Response) {
  await service.reject(me(req), req.params.id, vb(req, rejectSchema).comment, req.ip);
  ok(res, null, 'Registration rejected');
}

export async function update(req: Request, res: Response) {
  ok(res, await service.update(me(req), req.params.id, vb(req, updateUserSchema), req.ip), 'Employee updated');
}

export async function remove(req: Request, res: Response) {
  await service.remove(me(req), req.params.id, req.ip);
  ok(res, null, 'Employee removed');
}

export async function updateProfile(req: Request, res: Response) {
  const user = me(req);
  await service.updateProfile(user.id, vb(req, updateProfileSchema));
  ok(res, await toSessionUser(user.id), 'Profile saved');
}

export async function profile(req: Request, res: Response) {
  ok(res, await service.getById(me(req), me(req).id));
}

export async function uploadAvatar(req: Request, res: Response) {
  if (!req.file) throw AppError.badRequest('Choose an image to upload', 'NO_FILE');
  const stored = await storeFile(req.file, 'avatars');
  await service.setAvatar(me(req).id, stored.url);
  ok(res, await toSessionUser(me(req).id), 'Photo updated');
}
