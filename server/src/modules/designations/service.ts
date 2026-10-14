import type { DesignationDto, DesignationInput, PaginationQuery } from '@hajira/shared';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';
import { AppError } from '@/utils/AppError';
import { pageArgs } from '@/utils/response';

const select = {
  id: true,
  title: true,
  level: true,
  department: { select: { id: true, name: true } },
  _count: { select: { users: { where: { deletedAt: null } } } },
} satisfies Prisma.DesignationSelect;

type Row = Prisma.DesignationGetPayload<{ select: typeof select }>;
const toDto = (d: Row): DesignationDto => ({
  id: d.id,
  title: d.title,
  level: d.level,
  department: d.department,
  employeeCount: d._count.users,
});

export async function list(q: PaginationQuery & { departmentId?: string }) {
  const where: Prisma.DesignationWhereInput = {
    ...(q.search ? { title: { contains: q.search, mode: 'insensitive' } } : {}),
    ...(q.departmentId ? { departmentId: q.departmentId } : {}),
  };
  const orderBy: Prisma.DesignationOrderByWithRelationInput =
    q.sort === 'level' ? { level: q.order } : q.sort === 'department' ? { department: { name: q.order } } : { title: q.sort ? q.order : 'asc' };
  const [rows, total] = await Promise.all([
    prisma.designation.findMany({ where, select, orderBy, ...pageArgs(q) }),
    prisma.designation.count({ where }),
  ]);
  return { rows: rows.map(toDto), total };
}

/** For selects. With a department, returns its designations plus company-wide ones. */
export function options(departmentId?: string) {
  return prisma.designation.findMany({
    where: departmentId ? { OR: [{ departmentId }, { departmentId: null }] } : {},
    select: { id: true, title: true, departmentId: true },
    orderBy: [{ level: 'asc' }, { title: 'asc' }],
  });
}

export async function create(input: DesignationInput, actorId: string, ip?: string) {
  const row = await prisma.designation.create({
    data: { title: input.title, level: input.level ?? null, departmentId: input.departmentId || null },
    select,
  });
  await audit({ actorId, action: 'designation.create', entity: 'Designation', entityId: row.id, after: input, ip });
  return toDto(row);
}

export async function update(id: string, input: DesignationInput, actorId: string, ip?: string) {
  const before = await prisma.designation.findUnique({ where: { id } });
  if (!before) throw AppError.notFound('Designation');
  const row = await prisma.designation.update({
    where: { id },
    data: { title: input.title, level: input.level ?? null, departmentId: input.departmentId || null },
    select,
  });
  await audit({ actorId, action: 'designation.update', entity: 'Designation', entityId: id, before, after: input, ip });
  return toDto(row);
}

export async function remove(id: string, actorId: string, ip?: string) {
  const row = await prisma.designation.findUnique({ where: { id }, select });
  if (!row) throw AppError.notFound('Designation');
  if (row._count.users > 0) {
    throw AppError.conflict(`${row._count.users} employee(s) still hold this designation`, 'DESIGNATION_IN_USE');
  }
  await prisma.designation.delete({ where: { id } });
  await audit({ actorId, action: 'designation.delete', entity: 'Designation', entityId: id, before: toDto(row), ip });
}
