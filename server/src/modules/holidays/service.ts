import type { HolidayDto, HolidayInput } from '@hajira/shared';
import type { Holiday } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';
import { AppError } from '@/utils/AppError';
import { dateStr, dbDate } from '@/lib/time';

const toDto = (h: Holiday): HolidayDto => ({
  id: h.id,
  name: h.name,
  date: dateStr(h.date),
  type: h.type,
  description: h.description,
});

export async function list(year: number) {
  const rows = await prisma.holiday.findMany({
    where: { date: { gte: dbDate(`${year}-01-01`), lte: dbDate(`${year}-12-31`) } },
    orderBy: { date: 'asc' },
  });
  return rows.map(toDto);
}

export async function create(input: HolidayInput, actorId: string, ip?: string) {
  const row = await prisma.holiday.create({
    data: { name: input.name, date: dbDate(input.date), type: input.type, description: input.description || null },
  });
  await audit({ actorId, action: 'holiday.create', entity: 'Holiday', entityId: row.id, after: input, ip });
  return toDto(row);
}

export async function update(id: string, input: HolidayInput, actorId: string, ip?: string) {
  const before = await prisma.holiday.findUnique({ where: { id } });
  if (!before) throw AppError.notFound('Holiday');
  const row = await prisma.holiday.update({
    where: { id },
    data: { name: input.name, date: dbDate(input.date), type: input.type, description: input.description || null },
  });
  await audit({ actorId, action: 'holiday.update', entity: 'Holiday', entityId: id, before: toDto(before), after: input, ip });
  return toDto(row);
}

export async function remove(id: string, actorId: string, ip?: string) {
  const row = await prisma.holiday.findUnique({ where: { id } });
  if (!row) throw AppError.notFound('Holiday');
  await prisma.holiday.delete({ where: { id } });
  await audit({ actorId, action: 'holiday.delete', entity: 'Holiday', entityId: id, before: toDto(row), ip });
}
