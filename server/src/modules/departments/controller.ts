import type { Request, Response } from 'express';
import { departmentSchema, paginationQuery } from '@hajira/shared';
import { vb, vq } from '@/middleware/validate';
import { me } from '@/middleware/auth';
import { created, ok, paginated } from '@/utils/response';
import * as service from './service';

export async function list(req: Request, res: Response) {
  const q = vq(req, paginationQuery);
  const { rows, total } = await service.list(q);
  paginated(res, rows, { page: q.page, limit: q.limit, total });
}

export async function options(_req: Request, res: Response) {
  res.set('Cache-Control', 'public, max-age=300');
  ok(res, await service.options());
}

export async function create(req: Request, res: Response) {
  created(res, await service.create(vb(req, departmentSchema), me(req).id, req.ip), 'Department created');
}

export async function update(req: Request, res: Response) {
  ok(res, await service.update(req.params.id, vb(req, departmentSchema), me(req).id, req.ip), 'Department updated');
}

export async function remove(req: Request, res: Response) {
  await service.remove(req.params.id, me(req).id, req.ip);
  ok(res, null, 'Department deleted');
}
