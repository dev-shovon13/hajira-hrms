import type { Request, Response } from 'express';
import { designationSchema } from '@hajira/shared';
import { vb, vq } from '@/middleware/validate';
import { me } from '@/middleware/auth';
import { created, ok, paginated } from '@/utils/response';
import { designationListQuery } from './schema';
import * as service from './service';

export async function list(req: Request, res: Response) {
  const q = vq(req, designationListQuery);
  const { rows, total } = await service.list(q);
  paginated(res, rows, { page: q.page, limit: q.limit, total });
}

export async function options(req: Request, res: Response) {
  res.set('Cache-Control', 'public, max-age=300');
  const departmentId = typeof req.query.departmentId === 'string' ? req.query.departmentId : undefined;
  ok(res, await service.options(departmentId));
}

export async function create(req: Request, res: Response) {
  created(res, await service.create(vb(req, designationSchema), me(req).id, req.ip), 'Designation created');
}

export async function update(req: Request, res: Response) {
  ok(res, await service.update(req.params.id, vb(req, designationSchema), me(req).id, req.ip), 'Designation updated');
}

export async function remove(req: Request, res: Response) {
  await service.remove(req.params.id, me(req).id, req.ip);
  ok(res, null, 'Designation deleted');
}
