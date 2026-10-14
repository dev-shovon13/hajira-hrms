import type { DepartmentDto, DepartmentInput, PaginationQuery } from '@hajira/shared';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';
import { AppError } from '@/utils/AppError';
import { pageArgs } from '@/utils/response';

const select = {
  id: true,
  name: true,
  code: true,
  description: true,
  createdAt: true,
  head: { select: { id: true, name: true } },
  defaultShift: { select: { id: true, name: true } },
  _count: { select: { members: { where: { deletedAt: null, status: 'ACTIVE' as const } } } },
} satisfies Prisma.DepartmentSelect;

type Row = Prisma.DepartmentGetPayload<{ select: typeof select }>;

const toDto = (d: Row): DepartmentDto => ({
  id: d.id,
  name: d.name,
  code: d.code,
  description: d.description,
  head: d.head,
  defaultShift: d.defaultShift,
  employeeCount: d._count.members,
  createdAt: d.createdAt.toISOString(),
});

const SORTABLE = new Set(['name', 'code', 'createdAt']);

export async function list(q: PaginationQuery) {
  const where: Prisma.DepartmentWhereInput = {
    deletedAt: null,
    ...(q.search
      ? { OR: [{ name: { contains: q.search, mode: 'insensitive' } }, { code: { contains: q.search, mode: 'insensitive' } }] }
      : {}),
  };
  const sort = q.sort && SORTABLE.has(q.sort) ? q.sort : 'name';
  const [rows, total] = await Promise.all([
    prisma.department.findMany({ where, select, orderBy: { [sort]: q.sort ? q.order : 'asc' }, ...pageArgs(q) }),
    prisma.department.count({ where }),
  ]);
  return { rows: rows.map(toDto), total };
}

/** Lightweight list for selects (public: the register form needs it). */
export function options() {
  return prisma.department.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, code: true },
    orderBy: { name: 'asc' },
  });
}

export async function create(input: DepartmentInput, actorId: string, ip?: string) {
  const row = await prisma.department.create({
    data: {
      name: input.name,
      code: input.code,
      description: input.description || null,
      headId: input.headId || null,
      defaultShiftId: input.defaultShiftId || null,
    },
    select,
  });
  await audit({ actorId, action: 'department.create', entity: 'Department', entityId: row.id, after: input, ip });
  return toDto(row);
}

export async function update(id: string, input: DepartmentInput, actorId: string, ip?: string) {
  const before = await prisma.department.findFirst({ where: { id, deletedAt: null } });
  if (!before) throw AppError.notFound('Department');
  const row = await prisma.department.update({
    where: { id },
    data: {
      name: input.name,
      code: input.code,
      description: input.description || null,
      headId: input.headId || null,
      defaultShiftId: input.defaultShiftId || null,
    },
    select,
  });
  await audit({ actorId, action: 'department.update', entity: 'Department', entityId: id, before, after: input, ip });
  return toDto(row);
}

/** Soft delete. Refuses while active employees still belong to it. */
export async function remove(id: string, actorId: string, ip?: string) {
  const dept = await prisma.department.findFirst({ where: { id, deletedAt: null }, select });
  if (!dept) throw AppError.notFound('Department');
  if (dept._count.members > 0) {
    throw AppError.conflict(
      `Move the ${dept._count.members} employee${dept._count.members === 1 ? '' : 's'} in ${dept.name} to another department first`,
      'DEPARTMENT_NOT_EMPTY',
    );
  }
  // Free the unique name/code so they can be reused.
  const stamp = Date.now().toString(36);
  await prisma.department.update({
    where: { id },
    data: { deletedAt: new Date(), name: `${dept.name} (deleted ${stamp})`, code: `${dept.code}-${stamp}`.slice(0, 30) },
  });
  await audit({ actorId, action: 'department.delete', entity: 'Department', entityId: id, before: toDto(dept), ip });
}
