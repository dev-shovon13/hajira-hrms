import type { Request, Response } from 'express';
import { regularizationSchema, rejectSchema, requestListQuery, reviewSchema } from '@hajira/shared';
import { me } from '@/middleware/auth';
import { vb, vq } from '@/middleware/validate';
import { created, ok, paginated } from '@/utils/response';
import * as service from './service';

export async function list(req: Request, res: Response) {
  const q = vq(req, requestListQuery);
  const { rows, total } = await service.list(me(req), q);
  paginated(res, rows, { page: q.page, limit: q.limit, total });
}

export async function create(req: Request, res: Response) {
  created(res, await service.create(me(req), vb(req, regularizationSchema)), 'Correction requested. Your manager has been notified.');
}

export async function approve(req: Request, res: Response) {
  const r = await service.approve(me(req), req.params.id, vb(req, reviewSchema).comment || undefined, req.ip);
  ok(res, r, `Approved. ${r.user.name}'s attendance is updated.`);
}

export async function reject(req: Request, res: Response) {
  ok(res, await service.reject(me(req), req.params.id, vb(req, rejectSchema).comment, req.ip), 'Correction rejected');
}

export async function cancel(req: Request, res: Response) {
  ok(res, await service.cancel(me(req), req.params.id), 'Request cancelled');
}
