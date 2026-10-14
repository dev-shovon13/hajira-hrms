import type { AssignShiftInput, ShiftInput } from '@hajira/shared';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';
import { AppError } from '@/utils/AppError';
import { addDaysStr, dbDate, fromHHmm } from '@/lib/time';
import { toShiftDto } from '@/lib/schedule';

function toData(input: ShiftInput) {
  const startMinutes = fromHHmm(input.startTime);
  const endMinutes = fromHHmm(input.endTime);
  if (input.type !== 'NIGHT' && endMinutes <= startMinutes) {
    throw AppError.unprocessable('Only night shifts can end after midnight', 'SHIFT_WRAPS', {
      endTime: ['End time must be after start time (or choose the Night type)'],
    });
  }
  return {
    name: input.name,
    type: input.type,
    startMinutes,
    endMinutes,
    graceMinutes: input.graceMinutes,
    earlyLeaveGraceMinutes: input.earlyLeaveGraceMinutes,
    halfDayMinutes: input.halfDayMinutes,
    weeklyOffDays: [...new Set(input.weeklyOffDays)].sort(),
    isDefault: input.isDefault,
  };
}

export async function list() {
  const today = dbDate(new Date().toISOString().slice(0, 10));
  const shifts = await prisma.shift.findMany({
    where: { isActive: true },
    orderBy: [{ isDefault: 'desc' }, { startMinutes: 'asc' }],
    include: {
      _count: {
        select: { assignments: { where: { OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }] } } },
      },
    },
  });
  return shifts.map((s) => toShiftDto(s, s._count.assignments));
}

async function clearOtherDefaults(exceptId: string) {
  await prisma.shift.updateMany({ where: { id: { not: exceptId }, isDefault: true }, data: { isDefault: false } });
}

export async function create(input: ShiftInput, actorId: string, ip?: string) {
  const shift = await prisma.shift.create({ data: toData(input) });
  if (shift.isDefault) await clearOtherDefaults(shift.id);
  await audit({ actorId, action: 'shift.create', entity: 'Shift', entityId: shift.id, after: input, ip });
  return toShiftDto(shift);
}

export async function update(id: string, input: ShiftInput, actorId: string, ip?: string) {
  const before = await prisma.shift.findUnique({ where: { id } });
  if (!before || !before.isActive) throw AppError.notFound('Shift');
  const shift = await prisma.shift.update({ where: { id }, data: toData(input) });
  if (shift.isDefault) await clearOtherDefaults(shift.id);
  await audit({ actorId, action: 'shift.update', entity: 'Shift', entityId: id, before: toShiftDto(before), after: input, ip });
  return toShiftDto(shift);
}

/** Deactivates the shift; history keeps pointing at it. */
export async function remove(id: string, actorId: string, ip?: string) {
  const shift = await prisma.shift.findUnique({ where: { id } });
  if (!shift || !shift.isActive) throw AppError.notFound('Shift');
  if (shift.isDefault) throw AppError.conflict('Make another shift the default before removing this one', 'DEFAULT_SHIFT');
  await prisma.$transaction([
    prisma.shift.update({ where: { id }, data: { isActive: false } }),
    prisma.department.updateMany({ where: { defaultShiftId: id }, data: { defaultShiftId: null } }),
  ]);
  await audit({ actorId, action: 'shift.delete', entity: 'Shift', entityId: id, before: toShiftDto(shift), ip });
}

/**
 * Assigns a shift from a date onward. Open assignments of the same employees
 * are closed the day before so history stays exact.
 */
export async function assign(id: string, input: AssignShiftInput, actorId: string, ip?: string) {
  const shift = await prisma.shift.findUnique({ where: { id } });
  if (!shift || !shift.isActive) throw AppError.notFound('Shift');

  let userIds = input.userIds ?? [];
  if (input.departmentId) {
    const members = await prisma.user.findMany({
      where: { departmentId: input.departmentId, deletedAt: null, status: { in: ['ACTIVE', 'INVITED'] } },
      select: { id: true },
    });
    userIds = [...new Set([...userIds, ...members.map((m) => m.id)])];
    await prisma.department.update({ where: { id: input.departmentId }, data: { defaultShiftId: id } });
  }
  if (userIds.length === 0) throw AppError.badRequest('No employees to assign', 'NOBODY');

  const from = dbDate(input.effectiveFrom);
  const dayBefore = dbDate(addDaysStr(input.effectiveFrom, -1));
  await prisma.$transaction([
    // Assignments starting on/after the new date are superseded entirely.
    prisma.employeeShift.deleteMany({ where: { userId: { in: userIds }, effectiveFrom: { gte: from } } }),
    prisma.employeeShift.updateMany({
      where: { userId: { in: userIds }, effectiveFrom: { lt: from }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }] },
      data: { effectiveTo: dayBefore },
    }),
    prisma.employeeShift.createMany({ data: userIds.map((userId) => ({ userId, shiftId: id, effectiveFrom: from })) }),
  ]);
  await audit({
    actorId,
    action: 'shift.assign',
    entity: 'Shift',
    entityId: id,
    after: { userIds, departmentId: input.departmentId, effectiveFrom: input.effectiveFrom },
    ip,
  });
  return { assigned: userIds.length };
}
