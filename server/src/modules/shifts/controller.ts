import type { Request, Response } from 'express';
import { assignShiftSchema, shiftSchema } from '@hajira/shared';
import { vb } from '@/middleware/validate';
import { me } from '@/middleware/auth';
import { created, ok } from '@/utils/response';
import * as service from './service';

export async function list(_req: Request, res: Response) {
  res.set('Cache-Control', 'private, max-age=60');
  ok(res, await service.list());
}

export async function create(req: Request, res: Response) {
  created(res, await service.create(vb(req, shiftSchema), me(req).id, req.ip), 'Shift created');
}

export async function update(req: Request, res: Response) {
  ok(res, await service.update(req.params.id, vb(req, shiftSchema), me(req).id, req.ip), 'Shift updated');
}

export async function remove(req: Request, res: Response) {
  await service.remove(req.params.id, me(req).id, req.ip);
  ok(res, null, 'Shift removed');
}

export async function assign(req: Request, res: Response) {
  const result = await service.assign(req.params.id, vb(req, assignShiftSchema), me(req).id, req.ip);
  ok(res, result, `Shift assigned to ${result.assigned} employee${result.assigned === 1 ? '' : 's'}`);
}
