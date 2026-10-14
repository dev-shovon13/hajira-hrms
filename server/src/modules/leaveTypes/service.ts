import type { LeaveType } from '@prisma/client';
import type { LeaveTypeDto, LeaveTypeInput } from '@hajira/shared';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';
import { AppError } from '@/utils/AppError';

export const toDto = (t: LeaveType): LeaveTypeDto => ({
  id: t.id,
  name: t.name,
  code: t.code,
  yearlyQuota: t.yearlyQuota,
  isPaid: t.isPaid,
  carryForward: t.carryForward,
  maxCarryForward: t.maxCarryForward,
  maxConsecutiveDays: t.maxConsecutiveDays,
  allowHalfDay: t.allowHalfDay,
  requiresAttachmentAfterDays: t.requiresAttachmentAfterDays,
  color: t.color,
  isActive: t.isActive,
});

export async function list(includeInactive: boolean) {
  const rows = await prisma.leaveType.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ isPaid: 'desc' }, { name: 'asc' }],
  });
  return rows.map(toDto);
}

const data = (i: LeaveTypeInput) => ({
  name: i.name,
  code: i.code,
  yearlyQuota: i.isPaid ? i.yearlyQuota : 0,
  isPaid: i.isPaid,
  carryForward: i.carryForward,
  maxCarryForward: i.carryForward ? i.maxCarryForward : 0,
  maxConsecutiveDays: i.maxConsecutiveDays ?? null,
  allowHalfDay: i.allowHalfDay,
  requiresAttachmentAfterDays: i.requiresAttachmentAfterDays ?? null,
  color: i.color ?? null,
  isActive: i.isActive,
});

export async function create(input: LeaveTypeInput, actorId: string, ip?: string) {
  const row = await prisma.leaveType.create({ data: data(input) });
  await audit({ actorId, action: 'leave_type.create', entity: 'LeaveType', entityId: row.id, after: input, ip });
  return toDto(row);
}

/**
 * Updates the type. A quota change also updates this year's allocations so
 * balances follow the policy immediately.
 */
export async function update(id: string, input: LeaveTypeInput, actorId: string, ip?: string) {
  const before = await prisma.leaveType.findUnique({ where: { id } });
  if (!before) throw AppError.notFound('Leave type');
  const row = await prisma.leaveType.update({ where: { id }, data: data(input) });
  if (before.yearlyQuota !== row.yearlyQuota) {
    await prisma.leaveBalance.updateMany({ where: { leaveTypeId: id, year: new Date().getFullYear() }, data: { allocated: row.yearlyQuota } });
  }
  await audit({ actorId, action: 'leave_type.update', entity: 'LeaveType', entityId: id, before: toDto(before), after: input, ip });
  return toDto(row);
}

/** Archives the type: it disappears from new requests, history keeps it. */
export async function archive(id: string, actorId: string, ip?: string) {
  const row = await prisma.leaveType.findUnique({ where: { id } });
  if (!row) throw AppError.notFound('Leave type');
  const pending = await prisma.leaveRequest.count({ where: { leaveTypeId: id, status: 'PENDING' } });
  if (pending > 0) throw AppError.conflict(`Decide the ${pending} pending request(s) of this type first`, 'TYPE_IN_USE');
  await prisma.leaveType.update({ where: { id }, data: { isActive: false } });
  await audit({ actorId, action: 'leave_type.archive', entity: 'LeaveType', entityId: id, before: toDto(row), ip });
}
