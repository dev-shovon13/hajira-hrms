import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import type { RegularizationDto, RegularizationInput, requestListQuery } from '@hajira/shared';
import { prisma } from '@/lib/prisma';
import { getSettings } from '@/lib/settings';
import { audit } from '@/lib/audit';
import { notify, notifyMany, usersWithRoles } from '@/lib/notify';
import { emails } from '@/emails/templates';
import { AppError } from '@/utils/AppError';
import { pageArgs } from '@/utils/response';
import { dateStr, dbDate, daysBetween, formatHuman, fromHHmm, localDate, zonedInstant } from '@/lib/time';
import { crossesMidnight } from '@/lib/schedule';
import { isHrOrAdmin } from '@/middleware/auth';
import { dayContext, toDto as attendanceDto } from '@/modules/attendance/service';
import { evaluate } from '@/modules/attendance/engine';

type Actor = Express.AuthUser;

const MAX_AGE_DAYS = 30;

const include = {
  user: { select: { id: true, name: true, email: true, avatarUrl: true, managerId: true, department: { select: { id: true, name: true } } } },
  reviewer: { select: { id: true, name: true } },
  attendance: { select: { checkIn: true, checkOut: true, status: true } },
} satisfies Prisma.RegularizationRequestInclude;

type Row = Prisma.RegularizationRequestGetPayload<{ include: typeof include }>;

function canDecide(actor: Actor, r: Row) {
  if (r.status !== 'PENDING' || r.userId === actor.id) return false;
  return isHrOrAdmin(actor.role) || r.user.managerId === actor.id;
}

const toDto = (r: Row, actor?: Actor): RegularizationDto => ({
  id: r.id,
  date: dateStr(r.date),
  requestedCheckIn: r.requestedCheckIn?.toISOString() ?? null,
  requestedCheckOut: r.requestedCheckOut?.toISOString() ?? null,
  reason: r.reason,
  status: r.status,
  reviewComment: r.reviewComment,
  reviewedAt: r.reviewedAt?.toISOString() ?? null,
  createdAt: r.createdAt.toISOString(),
  reviewer: r.reviewer,
  user: { id: r.user.id, name: r.user.name, avatarUrl: r.user.avatarUrl, department: r.user.department },
  original: r.attendance
    ? { checkIn: r.attendance.checkIn?.toISOString() ?? null, checkOut: r.attendance.checkOut?.toISOString() ?? null, status: r.attendance.status }
    : null,
  ...(actor ? { canDecide: canDecide(actor, r) } : {}),
});

export async function create(actor: Actor, input: RegularizationInput) {
  const { timezone: tz } = await getSettings();
  const today = localDate(new Date(), tz);
  if (input.date > today) throw AppError.unprocessable('You can only correct days that have already started', 'FUTURE_DATE');
  if (daysBetween(input.date, today) > MAX_AGE_DAYS) {
    throw AppError.unprocessable(`Corrections must be requested within ${MAX_AGE_DAYS} days`, 'TOO_OLD');
  }
  const dup = await prisma.regularizationRequest.findFirst({
    where: { userId: actor.id, date: dbDate(input.date), status: 'PENDING' },
  });
  if (dup) throw AppError.conflict('You already have a pending correction for this date', 'DUPLICATE_REQUEST');

  const ctx = await dayContext(actor.id, input.date, tz);
  const checkIn = input.checkIn ? zonedInstant(input.date, fromHHmm(input.checkIn), tz) : null;
  // A check-out "earlier" than check-in on a night shift means the next morning.
  let checkOut = input.checkOut ? zonedInstant(input.date, fromHHmm(input.checkOut), tz) : null;
  if (checkIn && checkOut && checkOut <= checkIn && crossesMidnight(ctx.shift)) {
    checkOut = zonedInstant(input.date, fromHHmm(input.checkOut!) + 1440, tz);
  }
  if (checkIn && checkOut && checkOut <= checkIn) {
    throw AppError.unprocessable('Check-out must be after check-in', 'BAD_TIMES', { checkOut: ['Must be after check-in'] });
  }
  if ((checkIn && checkIn > new Date()) || (checkOut && checkOut > new Date())) {
    throw AppError.unprocessable('Times cannot be in the future', 'FUTURE_TIME');
  }

  const attendance = await prisma.attendance.findUnique({ where: { userId_date: { userId: actor.id, date: dbDate(input.date) } } });
  const row = await prisma.regularizationRequest.create({
    data: {
      userId: actor.id,
      attendanceId: attendance?.id,
      date: dbDate(input.date),
      requestedCheckIn: checkIn,
      requestedCheckOut: checkOut,
      reason: input.reason,
    },
    include,
  });

  const approvers = row.user.managerId
    ? await prisma.user.findMany({ where: { id: row.user.managerId }, select: { id: true } })
    : await usersWithRoles(['HR', 'ADMIN'], actor.id);
  await notifyMany(
    approvers.map((a) => ({
      userId: a.id,
      type: 'REGULARIZATION' as const,
      title: `${actor.name} asked for an attendance correction`,
      body: `${formatHuman(input.date)}: ${input.reason.slice(0, 120)}`,
      link: '/approvals?tab=regularization',
    })),
  );
  return toDto(row, actor);
}

async function load(id: string) {
  const r = await prisma.regularizationRequest.findUnique({ where: { id }, include });
  if (!r) throw AppError.notFound('Correction request');
  return r;
}

export async function approve(actor: Actor, id: string, comment: string | undefined, ip?: string) {
  const r = await load(id);
  if (!canDecide(actor, r)) throw AppError.forbidden('You cannot decide this request', 'CANNOT_DECIDE');
  const { timezone: tz } = await getSettings();
  const date = dateStr(r.date);
  const ctx = await dayContext(r.userId, date, tz);

  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.attendance.findUnique({ where: { userId_date: { userId: r.userId, date: r.date } } });
    const checkIn = r.requestedCheckIn ?? existing?.checkIn ?? null;
    const checkOut = r.requestedCheckOut ?? existing?.checkOut ?? null;
    if (checkIn && checkOut && checkOut <= checkIn) {
      throw AppError.unprocessable('The corrected check-out would be before check-in', 'BAD_TIMES');
    }
    const result = evaluate(ctx, checkIn, checkOut);
    const data = { checkIn, checkOut, ...result, isFlagged: false, flagReason: null, autoClosed: false, note: `Regularized: ${r.reason}`.slice(0, 300) };
    const after = existing
      ? await tx.attendance.update({ where: { id: existing.id }, data })
      : await tx.attendance.create({ data: { userId: r.userId, date: r.date, ...data } });
    await audit(
      {
        actorId: actor.id,
        action: 'attendance.regularize',
        entity: 'Attendance',
        entityId: after.id,
        before: existing ? attendanceDto(existing) : null,
        after: { ...attendanceDto(after), requestId: r.id, comment },
        ip,
      },
      tx,
    );
    return tx.regularizationRequest.update({
      where: { id },
      data: { status: 'APPROVED', reviewerId: actor.id, reviewComment: comment || null, reviewedAt: new Date(), attendanceId: after.id },
      include,
    });
  });

  await notify({
    userId: r.userId,
    type: 'REGULARIZATION',
    title: 'Attendance correction approved',
    body: `${formatHuman(date)} was updated.`,
    link: '/attendance',
    email: emails.regularizationStatus(r.user.email, r.user.name, formatHuman(date), 'Approved', comment),
  });
  return toDto(updated, actor);
}

export async function reject(actor: Actor, id: string, comment: string, ip?: string) {
  const r = await load(id);
  if (!canDecide(actor, r)) throw AppError.forbidden('You cannot decide this request', 'CANNOT_DECIDE');
  const updated = await prisma.regularizationRequest.update({
    where: { id },
    data: { status: 'REJECTED', reviewerId: actor.id, reviewComment: comment, reviewedAt: new Date() },
    include,
  });
  await audit({ actorId: actor.id, action: 'regularization.reject', entity: 'RegularizationRequest', entityId: id, after: { comment }, ip });
  const date = formatHuman(dateStr(r.date));
  await notify({
    userId: r.userId,
    type: 'REGULARIZATION',
    title: 'Attendance correction rejected',
    body: `${date}: ${comment}`,
    link: '/attendance',
    email: emails.regularizationStatus(r.user.email, r.user.name, date, 'Rejected', comment),
  });
  return toDto(updated, actor);
}

export async function cancel(actor: Actor, id: string) {
  const r = await load(id);
  if (r.userId !== actor.id) throw AppError.forbidden('You can only cancel your own requests', 'NOT_OWNER');
  if (r.status !== 'PENDING') throw AppError.conflict('Only pending requests can be cancelled', 'NOT_PENDING');
  return toDto(await prisma.regularizationRequest.update({ where: { id }, data: { status: 'CANCELLED' }, include }), actor);
}

export async function list(actor: Actor, q: z.infer<typeof requestListQuery>) {
  const scope: Prisma.RegularizationRequestWhereInput =
    q.scope === 'mine'
      ? { userId: actor.id }
      : q.scope === 'approvals'
        ? isHrOrAdmin(actor.role)
          ? { status: 'PENDING', userId: { not: actor.id } }
          : { status: 'PENDING', user: { managerId: actor.id } }
        : isHrOrAdmin(actor.role)
          ? {}
          : { OR: [{ user: { managerId: actor.id } }, { userId: actor.id }] };
  const where: Prisma.RegularizationRequestWhereInput = {
    AND: [
      scope,
      q.status && q.scope !== 'approvals' ? { status: q.status } : {},
      q.userId ? { userId: q.userId } : {},
      q.departmentId ? { user: { departmentId: q.departmentId } } : {},
      q.from ? { date: { gte: dbDate(q.from) } } : {},
      q.to ? { date: { lte: dbDate(q.to) } } : {},
      q.search ? { user: { name: { contains: q.search, mode: 'insensitive' } } } : {},
    ],
  };
  const orderBy: Prisma.RegularizationRequestOrderByWithRelationInput = q.sort === 'date' ? { date: q.order } : { createdAt: q.order };
  const [rows, total] = await Promise.all([
    prisma.regularizationRequest.findMany({ where, include, orderBy, ...pageArgs(q) }),
    prisma.regularizationRequest.count({ where }),
  ]);
  return { rows: rows.map((r) => toDto(r, actor)), total };
}
