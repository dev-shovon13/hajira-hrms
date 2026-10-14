import type { Request, Response } from 'express';
import { leaveTypeSchema } from '@hajira/shared';
import { isHrOrAdmin, me } from '@/middleware/auth';
import { vb } from '@/middleware/validate';
import { created, ok } from '@/utils/response';
import * as service from './service';

export async function list(req: Request, res: Response) {
  const all = req.query.all === 'true' && isHrOrAdmin(me(req).role);
  res.set('Cache-Control', 'private, max-age=300');
  ok(res, await service.list(all));
}

export async function create(req: Request, res: Response) {
  created(res, await service.create(vb(req, leaveTypeSchema), me(req).id, req.ip), 'Leave type created');
}

export async function update(req: Request, res: Response) {
  ok(res, await service.update(req.params.id, vb(req, leaveTypeSchema), me(req).id, req.ip), 'Leave type updated');
}

export async function archive(req: Request, res: Response) {
  await service.archive(req.params.id, me(req).id, req.ip);
  ok(res, null, 'Leave type archived');
}
