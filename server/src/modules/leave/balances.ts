import type { LeaveBalanceDto } from '@hajira/shared';
import { prisma, type Tx } from '@/lib/prisma';
import { dbDate } from '@/lib/time';

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Creates any missing balances for a user and year. Carry-forward types bring
 * over the unused part of last year's balance, capped at maxCarryForward.
 */
export async function ensureBalances(userId: string, year: number, db: Tx = prisma) {
  const [types, existing] = await Promise.all([
    db.leaveType.findMany({ where: { isActive: true } }),
    db.leaveBalance.findMany({ where: { userId, year }, select: { leaveTypeId: true } }),
  ]);
  const have = new Set(existing.map((b) => b.leaveTypeId));
  const missing = types.filter((t) => !have.has(t.id));
  if (missing.length === 0) return;

  const previous = await db.leaveBalance.findMany({
    where: { userId, year: year - 1, leaveTypeId: { in: missing.filter((t) => t.carryForward).map((t) => t.id) } },
  });
  const prevByType = new Map(previous.map((b) => [b.leaveTypeId, b]));

  await db.leaveBalance.createMany({
    data: missing.map((t) => {
      const prev = prevByType.get(t.id);
      const unused = prev ? prev.allocated + prev.carriedForward + prev.adjusted - prev.used : 0;
      return {
        userId,
        leaveTypeId: t.id,
        year,
        allocated: t.yearlyQuota,
        carriedForward: t.carryForward ? round(Math.max(0, Math.min(unused, t.maxCarryForward))) : 0,
      };
    }),
    skipDuplicates: true,
  });
}

/** Days requested but not decided yet, per leave type, for the year. */
async function pendingByType(userId: string, year: number, db: Tx = prisma) {
  const rows = await db.leaveRequest.groupBy({
    by: ['leaveTypeId'],
    where: {
      userId,
      status: 'PENDING',
      startDate: { gte: dbDate(`${year}-01-01`), lte: dbDate(`${year}-12-31`) },
    },
    _sum: { days: true },
  });
  return new Map(rows.map((r) => [r.leaveTypeId, r._sum.days ?? 0]));
}

export async function getBalances(userId: string, year: number, db: Tx = prisma): Promise<LeaveBalanceDto[]> {
  await ensureBalances(userId, year, db);
  const [balances, pending] = await Promise.all([
    db.leaveBalance.findMany({
      where: { userId, year, leaveType: { isActive: true } },
      include: { leaveType: { select: { id: true, name: true, code: true, isPaid: true, color: true } } },
      orderBy: { leaveType: { name: 'asc' } },
    }),
    pendingByType(userId, year, db),
  ]);
  return balances.map((b) => {
    const p = pending.get(b.leaveTypeId) ?? 0;
    return {
      id: b.id,
      year: b.year,
      leaveType: b.leaveType,
      allocated: b.allocated,
      carriedForward: b.carriedForward,
      adjusted: b.adjusted,
      used: b.used,
      pending: p,
      available: round(b.allocated + b.carriedForward + b.adjusted - b.used - p),
    };
  });
}

export async function availableFor(userId: string, leaveTypeId: string, year: number, db: Tx = prisma) {
  const balances = await getBalances(userId, year, db);
  return balances.find((b) => b.leaveType.id === leaveTypeId) ?? null;
}
