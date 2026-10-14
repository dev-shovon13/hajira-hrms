import type { Request, Response } from 'express';
import { holidaySchema } from '@hajira/shared';
import { vb, vq } from '@/middleware/validate';
import { me } from '@/middleware/auth';
import { created, ok } from '@/utils/response';
import { holidayListQuery } from './schema';
import * as service from './service';

export async function list(req: Request, res: Response) {
  const { year } = vq(req, holidayListQuery);
  res.set('Cache-Control', 'private, max-age=300');
  ok(res, await service.list(year));
}

export async function create(req: Request, res: Response) {
  created(res, await service.create(vb(req, holidaySchema), me(req).id, req.ip), 'Holiday added');
}

export async function update(req: Request, res: Response) {
  ok(res, await service.update(req.params.id, vb(req, holidaySchema), me(req).id, req.ip), 'Holiday updated');
}

export async function remove(req: Request, res: Response) {
  await service.remove(req.params.id, me(req).id, req.ip);
  ok(res, null, 'Holiday removed');
}
