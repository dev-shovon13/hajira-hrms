import type { Request, Response } from 'express';
import { isHrOrAdmin, me } from '@/middleware/auth';
import { vb, vq } from '@/middleware/validate';
import { ok, paginated } from '@/utils/response';
import { AppError } from '@/utils/AppError';
import { prisma } from '@/lib/prisma';
import { formatClock } from '@/lib/time';
import { getSettings } from '@/lib/settings';
import { attendanceEditSchema, attendanceListQuery, monthQuery } from './schema';
import * as service from './service';

export async function today(req: Request, res: Response) {
  res.set('Cache-Control', 'no-store');
  ok(res, await service.today(me(req), req.ip));
}

export async function checkIn(req: Request, res: Response) {
  const record = await service.checkIn(me(req), req.ip);
  const { timezone } = await getSettings();
  const time = formatClock(new Date(record.checkIn!), timezone);
  ok(res, record, record.status === 'LATE' ? `Checked in at ${time}, ${record.lateMinutes} min late` : `Checked in at ${time}`);
}

export async function checkOut(req: Request, res: Response) {
  const record = await service.checkOut(me(req), req.ip);
  const h = Math.floor(record.workMinutes / 60);
  const m = record.workMinutes % 60;
  ok(res, record, `Checked out. ${h}h ${String(m).padStart(2, '0')}m today`);
}

export async function month(req: Request, res: Response) {
  const actor = me(req);
  const q = vq(req, monthQuery);
  const userId = q.userId ?? actor.id;
  if (userId !== actor.id && !isHrOrAdmin(actor.role)) {
    const report = await prisma.user.findFirst({ where: { id: userId, managerId: actor.id }, select: { id: true } });
    if (!report) throw AppError.forbidden();
  }
  ok(res, await service.month(userId, q.month));
}

export async function list(req: Request, res: Response) {
  const q = vq(req, attendanceListQuery);
  const { rows, total } = await service.list(me(req), q);
  paginated(res, rows, { page: q.page, limit: q.limit, total });
}

export async function edit(req: Request, res: Response) {
  ok(res, await service.edit(me(req), req.params.id, vb(req, attendanceEditSchema), req.ip), 'Attendance updated');
}
