import type { ApproverRole, Prisma } from '@prisma/client';
import type { z } from 'zod';
import type {
  ApplyLeaveInput,
  BalanceAdjustInput,
  CalendarEventDto,
  LeavePreviewDto,
  LeavePreviewInput,
  LeaveRequestDto,
  leaveListQuery,
} from '@hajira/shared';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';
import { notify, notifyMany, usersWithRoles } from '@/lib/notify';
import { emails } from '@/emails/templates';
import { getSettings } from '@/lib/settings';
import { AppError } from '@/utils/AppError';
import { pageArgs } from '@/utils/response';
import { dateStr, dbDate, eachDate, formatHuman, localDate, daysBetween } from '@/lib/time';
import { holidaysBetween, isOffDay, resolveShifts } from '@/lib/schedule';
import { isHrOrAdmin } from '@/middleware/auth';
import { availableFor, ensureBalances } from './balances';

type Actor = Express.AuthUser;

const MAX_BACKDATE_DAYS = 30;

// ---------- day counting ----------

/** Working days in a range for one employee: weekly offs (their shift) and holidays excluded. */
export async function countLeaveDays(userId: string, start: string, end: string, isHalfDay: boolean) {
  const [shift, holidays] = await Promise.all([
    resolveShifts([userId], start).then((m) => m.get(userId)!),
    holidaysBetween(start, end),
  ]);
  const workingDates: string[] = [];
  const excluded: LeavePreviewDto['excluded'] = [];
  for (const d of eachDate(start, end)) {
    if (holidays.has(d)) excluded.push({ date: d, reason: 'HOLIDAY', label: holidays.get(d)! });
    else if (isOffDay(shift, d)) excluded.push({ date: d, reason: 'WEEKEND', label: 'Weekly off' });
    else workingDates.push(d);
  }
  const days = isHalfDay ? (workingDates.length > 0 ? 0.5 : 0) : workingDates.length;
  return { days, workingDates, excluded };
}

async function overlapping(userId: string, start: string, end: string, excludeId?: string) {
  return prisma.leaveRequest.findFirst({
    where: {
      userId,
      status: { in: ['PENDING', 'APPROVED'] },
      startDate: { lte: dbDate(end) },
      endDate: { gte: dbDate(start) },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { startDate: true, endDate: true, status: true, leaveType: { select: { name: true } } },
  });
}

export async function preview(userId: string, input: LeavePreviewInput, tz: string): Promise<LeavePreviewDto> {
  const type = await prisma.leaveType.findUnique({ where: { id: input.leaveTypeId } });
  if (!type || !type.isActive) throw AppError.badRequest('Choose a valid leave type', 'BAD_LEAVE_TYPE');

  const problems: string[] = [];
  const isHalfDay = input.isHalfDay && input.startDate === input.endDate;
  const { days, workingDates, excluded } = await countLeaveDays(userId, input.startDate, input.endDate, isHalfDay);

  const today = localDate(new Date(), tz);
  if (daysBetween(input.startDate, today) > MAX_BACKDATE_DAYS) {
    problems.push(`Leave can be backdated by at most ${MAX_BACKDATE_DAYS} days`);
  }
  if (input.startDate.slice(0, 4) !== input.endDate.slice(0, 4)) {
    problems.push('Split leave that crosses into a new year into two requests');
  }
  if (days === 0) problems.push('Every selected date is a weekend or holiday, so there is nothing to deduct');
  if (input.isHalfDay && !type.allowHalfDay) problems.push(`${type.name} cannot be taken as a half day`);
  if (type.maxConsecutiveDays && days > type.maxConsecutiveDays) {
    problems.push(`${type.name} allows at most ${type.maxConsecutiveDays} consecutive working days`);
  }

  const clash = await overlapping(userId, input.startDate, input.endDate);
  if (clash) {
    problems.push(
      `Overlaps your ${clash.status.toLowerCase()} ${clash.leaveType.name.toLowerCase()} (${formatHuman(dateStr(clash.startDate))} – ${formatHuman(dateStr(clash.endDate))})`,
    );
  }

  let balance: LeavePreviewDto['balance'] = null;
  if (type.isPaid) {
    const b = await availableFor(userId, type.id, Number(input.startDate.slice(0, 4)));
    const available = b?.available ?? 0;
    balance = { available, afterApproval: Math.round((available - days) * 100) / 100 };
    if (days > available) {
      problems.push(
        available <= 0
          ? `No ${type.name.toLowerCase()} left this year. Choose unpaid leave instead.`
          : `Only ${available} day${available === 1 ? '' : 's'} of ${type.name.toLowerCase()} left`,
      );
    }
  }

  return {
    days,
    workingDates,
    excluded,
    balance,
    isPaid: type.isPaid,
    attachmentRequired: Boolean(type.requiresAttachmentAfterDays && days > type.requiresAttachmentAfterDays),
    problems,
  };
}

// ---------- approval chain ----------

async function buildChain(requester: { id: string; managerId: string | null }) {
  const { approvalFlow } = await getSettings();
  const chain: { level: number; approverRole: ApproverRole; decision: 'PENDING' | 'SKIPPED' }[] = [];
  approvalFlow.levels.forEach((role, i) => {
    const skip = role === 'MANAGER' && !requester.managerId;
    chain.push({ level: i + 1, approverRole: role, decision: skip ? 'SKIPPED' : 'PENDING' });
  });
  if (!chain.some((c) => c.decision === 'PENDING')) {
    chain.push({ level: chain.length + 1, approverRole: 'HR', decision: 'PENDING' });
  }
  return chain;
}

const requestInclude = {
  leaveType: { select: { id: true, name: true, code: true, color: true } },
  user: {
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      managerId: true,
      email: true,
      department: { select: { id: true, name: true } },
      designation: { select: { title: true } },
    },
  },
  approvals: { orderBy: { level: 'asc' }, include: { approver: { select: { id: true, name: true } } } },
} satisfies Prisma.LeaveRequestInclude;

type RequestRow = Prisma.LeaveRequestGetPayload<{ include: typeof requestInclude }>;

const currentApproval = (r: RequestRow) => r.approvals.find((a) => a.decision === 'PENDING') ?? null;

export function canDecide(actor: Actor, r: RequestRow) {
  if (r.status !== 'PENDING' || r.userId === actor.id) return false;
  const current = currentApproval(r);
  if (!current) return false;
  if (isHrOrAdmin(actor.role)) return true; // HR can act at any level
  return current.approverRole === 'MANAGER' && r.user.managerId === actor.id;
}

export function toDto(r: RequestRow, actor?: Actor): LeaveRequestDto {
  return {
    id: r.id,
    startDate: dateStr(r.startDate),
    endDate: dateStr(r.endDate),
    isHalfDay: r.isHalfDay,
    halfDaySession: r.halfDaySession,
    days: r.days,
    reason: r.reason,
    attachmentUrl: r.attachmentUrl,
    status: r.status,
    currentLevel: r.currentLevel,
    createdAt: r.createdAt.toISOString(),
    leaveType: r.leaveType,
    user: {
      id: r.user.id,
      name: r.user.name,
      avatarUrl: r.user.avatarUrl,
      department: r.user.department,
      designation: r.user.designation?.title ?? null,
    },
    approvals: r.approvals.map((a) => ({
      id: a.id,
      level: a.level,
      approverRole: a.approverRole,
      decision: a.decision,
      comment: a.comment,
      decidedAt: a.decidedAt?.toISOString() ?? null,
      approver: a.approver,
    })),
    ...(actor ? { canDecide: canDecide(actor, r) } : {}),
  };
}

const summary = (r: { days: number; startDate: Date; endDate: Date; leaveType: { name: string } }) => {
  const s = dateStr(r.startDate);
  const e = dateStr(r.endDate);
  const range = s === e ? formatHuman(s) : `${formatHuman(s)} – ${formatHuman(e)}`;
  return `${r.days} day${r.days === 1 ? '' : 's'} of ${r.leaveType.name.toLowerCase()}, ${range}`;
};

async function notifyApprovers(r: RequestRow) {
  const current = currentApproval(r);
  if (!current) return;
  const recipients =
    current.approverRole === 'MANAGER' && r.user.managerId
      ? await prisma.user.findMany({ where: { id: r.user.managerId }, select: { id: true, name: true, email: true } })
      : await usersWithRoles(['HR', 'ADMIN'], r.userId);
  const text = summary(r);
  await notifyMany(
    recipients.map((u) => ({
      userId: u.id,
      type: 'LEAVE_REQUEST' as const,
      title: `${r.user.name} requested leave`,
      body: text,
      link: '/approvals',
      email: emails.leaveRequest(u.email, u.name, r.user.name, text),
    })),
  );
}

// ---------- requests ----------

export async function apply(actor: Actor, input: ApplyLeaveInput) {
  const { timezone } = await getSettings();
  const check = await preview(actor.id, input, timezone);
  if (check.problems.length > 0) throw AppError.unprocessable(check.problems[0], 'LEAVE_NOT_ALLOWED');
  if (check.attachmentRequired && !input.attachmentUrl) {
    throw AppError.unprocessable('Attach a supporting document (e.g. a medical certificate) for leave this long', 'ATTACHMENT_REQUIRED', {
      attachmentUrl: ['A supporting document is required'],
    });
  }

  const requester = await prisma.user.findUniqueOrThrow({ where: { id: actor.id }, select: { id: true, managerId: true } });
  const chain = await buildChain(requester);
  const firstPending = chain.find((c) => c.decision === 'PENDING')!;

  const created = await prisma.leaveRequest.create({
    data: {
      userId: actor.id,
      leaveTypeId: input.leaveTypeId,
      startDate: dbDate(input.startDate),
      endDate: dbDate(input.endDate),
      isHalfDay: input.isHalfDay,
      halfDaySession: input.isHalfDay ? input.halfDaySession : null,
      days: check.days,
      reason: input.reason,
      attachmentUrl: input.attachmentUrl || null,
      currentLevel: firstPending.level,
      approvals: { create: chain },
    },
    include: requestInclude,
  });
  await notifyApprovers(created);
  return toDto(created, actor);
}

async function load(id: string) {
  const r = await prisma.leaveRequest.findUnique({ where: { id }, include: requestInclude });
  if (!r) throw AppError.notFound('Leave request');
  return r;
}

export async function approve(actor: Actor, id: string, comment: string | undefined, ip?: string) {
  const r = await load(id);
  if (!canDecide(actor, r)) throw AppError.forbidden('You cannot approve this request', 'CANNOT_DECIDE');
  const current = currentApproval(r)!;
  const now = new Date();
  const hr = isHrOrAdmin(actor.role);

  // HR approving finishes every remaining level; a manager finishes only theirs.
  const closing = r.approvals.filter((a) => a.decision === 'PENDING' && (a.id === current.id || hr));
  const remaining = r.approvals.filter((a) => a.decision === 'PENDING' && !closing.includes(a));
  const final = remaining.length === 0;
  const year = dateStr(r.startDate).slice(0, 4);

  const updated = await prisma.$transaction(async (tx) => {
    for (const a of closing) {
      await tx.leaveApproval.update({
        where: { id: a.id },
        data: { decision: 'APPROVED', approverId: actor.id, comment: a.id === current.id ? comment || null : 'Approved by HR', decidedAt: now },
      });
    }
    if (!final) {
      return tx.leaveRequest.update({ where: { id }, data: { currentLevel: remaining[0].level }, include: requestInclude });
    }

    // Final approval: re-check the balance inside the transaction, then deduct.
    const type = await tx.leaveType.findUniqueOrThrow({ where: { id: r.leaveTypeId } });
    await ensureBalances(r.userId, Number(year), tx);
    if (type.isPaid) {
      const bal = await tx.leaveBalance.findUniqueOrThrow({
        where: { userId_leaveTypeId_year: { userId: r.userId, leaveTypeId: r.leaveTypeId, year: Number(year) } },
      });
      const free = bal.allocated + bal.carriedForward + bal.adjusted - bal.used;
      if (r.days > free + 1e-9) {
        throw AppError.unprocessable(`${r.user.name} only has ${free} day(s) of ${type.name.toLowerCase()} left`, 'INSUFFICIENT_BALANCE');
      }
    }
    await tx.leaveBalance.update({
      where: { userId_leaveTypeId_year: { userId: r.userId, leaveTypeId: r.leaveTypeId, year: Number(year) } },
      data: { used: { increment: r.days } },
    });
    // Days already marked ABSENT become ON_LEAVE.
    await tx.attendance.updateMany({
      where: { userId: r.userId, date: { gte: r.startDate, lte: r.endDate }, status: 'ABSENT' },
      data: { status: 'ON_LEAVE' },
    });
    await audit(
      { actorId: actor.id, action: 'leave.approve', entity: 'LeaveRequest', entityId: id, before: { status: 'PENDING' }, after: { status: 'APPROVED', days: r.days, comment }, ip },
      tx,
    );
    return tx.leaveRequest.update({ where: { id }, data: { status: 'APPROVED' }, include: requestInclude });
  });

  if (final) {
    await notify({
      userId: r.userId,
      type: 'LEAVE_STATUS',
      title: 'Leave approved',
      body: summary(r),
      link: '/leave',
      email: emails.leaveStatus(r.user.email, r.user.name, summary(r), 'Approved', comment),
    });
  } else {
    await notifyApprovers(updated);
    await audit({ actorId: actor.id, action: 'leave.approve_level', entity: 'LeaveRequest', entityId: id, after: { level: current.level, comment }, ip });
  }
  return toDto(updated, actor);
}

export async function reject(actor: Actor, id: string, comment: string, ip?: string) {
  const r = await load(id);
  if (!canDecide(actor, r)) throw AppError.forbidden('You cannot reject this request', 'CANNOT_DECIDE');
  const current = currentApproval(r)!;
  const updated = await prisma.$transaction(async (tx) => {
    await tx.leaveApproval.update({
      where: { id: current.id },
      data: { decision: 'REJECTED', approverId: actor.id, comment, decidedAt: new Date() },
    });
    await tx.leaveApproval.updateMany({ where: { leaveRequestId: id, decision: 'PENDING' }, data: { decision: 'SKIPPED' } });
    await audit({ actorId: actor.id, action: 'leave.reject', entity: 'LeaveRequest', entityId: id, before: { status: 'PENDING' }, after: { status: 'REJECTED', comment }, ip }, tx);
    return tx.leaveRequest.update({ where: { id }, data: { status: 'REJECTED' }, include: requestInclude });
  });
  await notify({
    userId: r.userId,
    type: 'LEAVE_STATUS',
    title: 'Leave rejected',
    body: `${summary(r)}. ${comment}`,
    link: '/leave',
    email: emails.leaveStatus(r.user.email, r.user.name, summary(r), 'Rejected', comment),
  });
  return toDto(updated, actor);
}

export async function cancel(actor: Actor, id: string) {
  const r = await load(id);
  if (r.userId !== actor.id) throw AppError.forbidden('You can only cancel your own requests', 'NOT_OWNER');
  if (r.status !== 'PENDING') throw AppError.conflict('Only pending requests can be cancelled', 'NOT_PENDING');
  const updated = await prisma.$transaction(async (tx) => {
    await tx.leaveApproval.updateMany({ where: { leaveRequestId: id, decision: 'PENDING' }, data: { decision: 'SKIPPED' } });
    return tx.leaveRequest.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date() }, include: requestInclude });
  });
  return toDto(updated, actor);
}

export async function getOne(actor: Actor, id: string) {
  const r = await load(id);
  const visible =
    r.userId === actor.id || isHrOrAdmin(actor.role) || (actor.role === 'MANAGER' && r.user.managerId === actor.id);
  if (!visible) throw AppError.notFound('Leave request');
  return toDto(r, actor);
}

export async function list(actor: Actor, q: z.infer<typeof leaveListQuery>) {
  const scopeWhere: Prisma.LeaveRequestWhereInput =
    q.scope === 'mine'
      ? { userId: actor.id }
      : q.scope === 'approvals'
        ? isHrOrAdmin(actor.role)
          ? { status: 'PENDING', userId: { not: actor.id } }
          : { status: 'PENDING', user: { managerId: actor.id }, approvals: { some: { approverRole: 'MANAGER', decision: 'PENDING' } } }
        : isHrOrAdmin(actor.role)
          ? {}
          : actor.role === 'MANAGER'
            ? { OR: [{ user: { managerId: actor.id } }, { userId: actor.id }] }
            : { userId: actor.id };

  const where: Prisma.LeaveRequestWhereInput = {
    AND: [
      scopeWhere,
      q.status && q.scope !== 'approvals' ? { status: q.status } : {},
      q.leaveTypeId ? { leaveTypeId: q.leaveTypeId } : {},
      q.userId ? { userId: q.userId } : {},
      q.departmentId ? { user: { departmentId: q.departmentId } } : {},
      q.from ? { endDate: { gte: dbDate(q.from) } } : {},
      q.to ? { startDate: { lte: dbDate(q.to) } } : {},
      q.search ? { user: { name: { contains: q.search, mode: 'insensitive' } } } : {},
    ],
  };
  const orderBy: Prisma.LeaveRequestOrderByWithRelationInput =
    q.sort === 'startDate' ? { startDate: q.order } : q.sort === 'days' ? { days: q.order } : q.sort === 'name' ? { user: { name: q.order } } : { createdAt: q.order };

  const [rows, total] = await Promise.all([
    prisma.leaveRequest.findMany({ where, include: requestInclude, orderBy, ...pageArgs(q) }),
    prisma.leaveRequest.count({ where }),
  ]);
  return { rows: rows.map((r) => toDto(r, actor)), total };
}

/** Team calendar: who is away (approved + pending) and holidays in a range. */
export async function calendar(actor: Actor, from: string, to: string, departmentId?: string): Promise<CalendarEventDto[]> {
  let userWhere: Prisma.UserWhereInput;
  if (isHrOrAdmin(actor.role)) userWhere = departmentId ? { departmentId } : {};
  else if (actor.role === 'MANAGER') userWhere = { OR: [{ managerId: actor.id }, { departmentId: actor.departmentId ?? '__none__' }, { id: actor.id }] };
  else userWhere = { departmentId: actor.departmentId ?? '__none__' };

  const [leaves, holidays] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: {
        status: { in: ['APPROVED', 'PENDING'] },
        startDate: { lte: dbDate(to) },
        endDate: { gte: dbDate(from) },
        user: { deletedAt: null, ...userWhere },
      },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        status: true,
        isHalfDay: true,
        // Colleagues see who is away, not why: no reason or attachment here.
        leaveType: { select: { name: true, code: true, color: true } },
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { startDate: 'asc' },
      take: 500,
    }),
    prisma.holiday.findMany({ where: { date: { gte: dbDate(from), lte: dbDate(to) } }, orderBy: { date: 'asc' } }),
  ]);

  return [
    ...holidays.map((h) => ({
      id: `h-${h.id}`,
      title: h.name,
      start: dateStr(h.date),
      end: dateStr(h.date),
      kind: 'HOLIDAY' as const,
      color: null,
    })),
    ...leaves.map((l) => ({
      id: l.id,
      title: l.user.name,
      start: dateStr(l.startDate),
      end: dateStr(l.endDate),
      kind: 'LEAVE' as const,
      status: l.status,
      color: l.leaveType.color,
      user: l.user,
      leaveType: l.leaveType.name,
      leaveTypeCode: l.leaveType.code,
      isHalfDay: l.isHalfDay,
    })),
  ];
}

export async function adjustBalance(actor: Actor, input: BalanceAdjustInput, ip?: string) {
  await ensureBalances(input.userId, input.year);
  const where = { userId_leaveTypeId_year: { userId: input.userId, leaveTypeId: input.leaveTypeId, year: input.year } };
  const before = await prisma.leaveBalance.findUnique({ where });
  if (!before) throw AppError.notFound('Leave balance');
  const after = await prisma.leaveBalance.update({ where, data: { adjusted: { increment: input.delta } } });
  await audit({ actorId: actor.id, action: 'leave.balance_adjust', entity: 'LeaveBalance', entityId: before.id, before: { adjusted: before.adjusted }, after: { adjusted: after.adjusted, note: input.note }, ip });
  return after;
}
