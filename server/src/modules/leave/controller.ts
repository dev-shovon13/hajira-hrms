import type { Request, Response } from 'express';
import { isHrOrAdmin, me } from '@/middleware/auth';
import { vb, vq } from '@/middleware/validate';
import { created, ok, paginated } from '@/utils/response';
import { AppError } from '@/utils/AppError';
import { getSettings } from '@/lib/settings';
import { prisma } from '@/lib/prisma';
import { attachmentUpload, storeFile } from '@/lib/upload';
import {
  applyLeaveSchema,
  balanceAdjustSchema,
  balanceQuery,
  calendarQuery,
  leaveListQuery,
  leavePreviewSchema,
  rejectSchema,
  reviewSchema,
} from './schema';
import { getBalances } from './balances';
import * as service from './service';

export { attachmentUpload };

export async function balances(req: Request, res: Response) {
  const actor = me(req);
  const q = vq(req, balanceQuery);
  const userId = q.userId ?? actor.id;
  if (userId !== actor.id && !isHrOrAdmin(actor.role)) {
    const report = await prisma.user.findFirst({ where: { id: userId, managerId: actor.id }, select: { id: true } });
    if (!report) throw AppError.forbidden();
  }
  ok(res, await getBalances(userId, q.year));
}

export async function adjust(req: Request, res: Response) {
  await service.adjustBalance(me(req), vb(req, balanceAdjustSchema), req.ip);
  ok(res, null, 'Balance adjusted');
}

export async function preview(req: Request, res: Response) {
  const { timezone } = await getSettings();
  ok(res, await service.preview(me(req).id, vb(req, leavePreviewSchema), timezone));
}

export async function apply(req: Request, res: Response) {
  const r = await service.apply(me(req), vb(req, applyLeaveSchema));
  created(res, r, `Leave requested: ${r.days} day${r.days === 1 ? '' : 's'}. Your approver has been notified.`);
}

export async function list(req: Request, res: Response) {
  const q = vq(req, leaveListQuery);
  const { rows, total } = await service.list(me(req), q);
  paginated(res, rows, { page: q.page, limit: q.limit, total });
}

export async function getOne(req: Request, res: Response) {
  ok(res, await service.getOne(me(req), req.params.id));
}

export async function approve(req: Request, res: Response) {
  const r = await service.approve(me(req), req.params.id, vb(req, reviewSchema).comment || undefined, req.ip);
  ok(res, r, r.status === 'APPROVED' ? `Approved ${r.user.name}'s leave` : `Approved. Sent on to HR.`);
}

export async function reject(req: Request, res: Response) {
  const r = await service.reject(me(req), req.params.id, vb(req, rejectSchema).comment, req.ip);
  ok(res, r, `Rejected ${r.user.name}'s leave`);
}

export async function cancel(req: Request, res: Response) {
  ok(res, await service.cancel(me(req), req.params.id), 'Request cancelled');
}

export async function calendar(req: Request, res: Response) {
  const q = vq(req, calendarQuery);
  ok(res, await service.calendar(me(req), q.from, q.to, q.departmentId));
}

export async function uploadAttachment(req: Request, res: Response) {
  if (!req.file) throw AppError.badRequest('Choose a file to upload', 'NO_FILE');
  created(res, await storeFile(req.file, 'attachments'), 'File uploaded');
}
