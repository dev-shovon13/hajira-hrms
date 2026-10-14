import type { AttendanceStatus } from '@prisma/client';
import type {
  ActivityItem,
  AdminDashboardDto,
  EmployeeDashboardDto,
  ManagerDashboardDto,
} from '@hajira/shared';
import { prisma } from '@/lib/prisma';
import { getSettings } from '@/lib/settings';
import { addDaysStr, dateStr, dbDate, eachDate, formatClock, formatHuman, localDate, monthRange } from '@/lib/time';
import * as attendance from '@/modules/attendance/service';
import * as leave from '@/modules/leave/service';
import * as regularization from '@/modules/regularization/service';
import { getBalances } from '@/modules/leave/balances';
import { rowSelect, toRow } from '@/modules/users/service';

type Actor = Express.AuthUser;

const TONE: Record<AttendanceStatus, ActivityItem['tone']> = {
  PRESENT: 'present',
  LATE: 'late',
  ABSENT: 'absent',
  HALF_DAY: 'late',
  ON_LEAVE: 'leave',
  HOLIDAY: 'holiday',
  WEEKEND: 'neutral',
};

export async function employee(actor: Actor, ip?: string): Promise<EmployeeDashboardDto> {
  const { timezone: tz, latePolicy } = await getSettings();
  const todayStr = localDate(new Date(), tz);
  const { start, end } = monthRange(todayStr.slice(0, 7));

  const [today, month, balances, recentAttendance, recentLeave, lateCount] = await Promise.all([
    attendance.today(actor, ip),
    attendance.month(actor.id, todayStr.slice(0, 7)),
    getBalances(actor.id, Number(todayStr.slice(0, 4))),
    prisma.attendance.findMany({
      where: { userId: actor.id, checkIn: { not: null } },
      orderBy: { date: 'desc' },
      take: 5,
    }),
    prisma.leaveRequest.findMany({
      where: { userId: actor.id },
      orderBy: { updatedAt: 'desc' },
      take: 4,
      include: { leaveType: { select: { name: true } } },
    }),
    prisma.attendance.count({ where: { userId: actor.id, status: 'LATE', date: { gte: dbDate(start), lte: dbDate(end) } } }),
  ]);

  const activity: ActivityItem[] = [
    ...recentAttendance.map((a): ActivityItem => {
      const d = formatHuman(dateStr(a.date));
      const title =
        a.status === 'LATE'
          ? `Late check-in at ${formatClock(a.checkIn, tz)} (${a.lateMinutes} min)`
          : a.autoClosed
            ? `No check-out on ${d}; closed automatically`
            : a.checkOut
              ? `Worked ${formatClock(a.checkIn, tz)} – ${formatClock(a.checkOut, tz)}`
              : `Checked in at ${formatClock(a.checkIn, tz)}`;
      return { id: `a-${a.id}`, kind: 'ATTENDANCE', title, at: (a.checkOut ?? a.checkIn ?? a.date).toISOString(), tone: a.autoClosed ? 'absent' : TONE[a.status] };
    }),
    ...recentLeave.map((l): ActivityItem => ({
      id: `l-${l.id}`,
      kind: 'LEAVE',
      title: `${l.leaveType.name} ${l.status.toLowerCase()} · ${l.days} day${l.days === 1 ? '' : 's'} from ${formatHuman(dateStr(l.startDate))}`,
      at: l.updatedAt.toISOString(),
      tone: l.status === 'REJECTED' ? 'absent' : l.status === 'CANCELLED' ? 'neutral' : 'leave',
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 6);

  return {
    today,
    month,
    balances,
    activity,
    lateMarks: { count: lateCount, threshold: latePolicy.enabled ? latePolicy.lateMarksPerDeduction : null },
  };
}

async function trend(userIds: string[] | null, from: string, to: string) {
  const rows = await prisma.attendance.groupBy({
    by: ['date', 'status'],
    where: {
      date: { gte: dbDate(from), lte: dbDate(to) },
      ...(userIds ? { userId: { in: userIds } } : { user: { deletedAt: null } }),
    },
    _count: { _all: true },
  });
  const byDate = new Map<string, { present: number; late: number; absent: number; onLeave: number }>();
  for (const d of eachDate(from, to)) byDate.set(d, { present: 0, late: 0, absent: 0, onLeave: 0 });
  for (const r of rows) {
    const bucket = byDate.get(dateStr(r.date));
    if (!bucket) continue;
    const n = r._count._all;
    if (r.status === 'PRESENT' || r.status === 'HALF_DAY') bucket.present += n;
    else if (r.status === 'LATE') bucket.late += n;
    else if (r.status === 'ABSENT') bucket.absent += n;
    else if (r.status === 'ON_LEAVE') bucket.onLeave += n;
  }
  return [...byDate.entries()].map(([date, v]) => ({ date, ...v }));
}

function tally(statuses: { status: string }[]) {
  const t = { present: 0, late: 0, absent: 0, onLeave: 0, notIn: 0 };
  for (const s of statuses) {
    if (s.status === 'PRESENT' || s.status === 'HALF_DAY') t.present++;
    else if (s.status === 'LATE') t.late++;
    else if (s.status === 'ABSENT') t.absent++;
    else if (s.status === 'ON_LEAVE') t.onLeave++;
    else if (s.status === 'NOT_IN') t.notIn++;
  }
  return t;
}

export async function manager(actor: Actor): Promise<ManagerDashboardDto> {
  const { timezone: tz } = await getSettings();
  const todayStr = localDate(new Date(), tz);
  const members = await prisma.user.findMany({
    where: { managerId: actor.id, deletedAt: null, status: 'ACTIVE' },
    select: { id: true, name: true, avatarUrl: true, designation: { select: { title: true } } },
    orderBy: { name: 'asc' },
  });
  const ids = members.map((m) => m.id);
  const [today, pendingLeave, pendingReg, series] = await Promise.all([
    attendance.teamToday(ids, tz),
    leave.list(actor, { scope: 'approvals', page: 1, limit: 5, order: 'asc', sort: 'createdAt' }),
    regularization.list(actor, { scope: 'approvals', page: 1, limit: 5, order: 'asc', sort: 'createdAt' }),
    ids.length ? trend(ids, addDaysStr(todayStr, -13), todayStr) : Promise.resolve([]),
  ]);
  const byId = new Map(today.map((t) => [t.userId, t]));
  const t = tally(today);
  return {
    team: { total: ids.length, ...t },
    members: members.map((m) => {
      const s = byId.get(m.id);
      return {
        id: m.id,
        name: m.name,
        avatarUrl: m.avatarUrl,
        designation: m.designation?.title ?? null,
        status: s?.status ?? null,
        checkIn: s?.checkIn?.toISOString() ?? null,
        lateMinutes: s?.lateMinutes ?? 0,
      };
    }),
    pending: { leave: pendingLeave.rows, regularization: pendingReg.rows },
    trend: series,
  };
}

export async function admin(actor: Actor): Promise<AdminDashboardDto> {
  const { timezone: tz } = await getSettings();
  const todayStr = localDate(new Date(), tz);
  const year = todayStr.slice(0, 4);

  const people = await prisma.user.findMany({
    where: { deletedAt: null, status: 'ACTIVE' },
    select: { id: true, departmentId: true },
  });
  const ids = people.map((p) => p.id);

  const [today, series, departments, leaveSums, leaveTypes, onLeave, pendingAccounts, counts] = await Promise.all([
    attendance.teamToday(ids, tz),
    trend(null, addDaysStr(todayStr, -29), todayStr),
    prisma.department.findMany({ where: { deletedAt: null }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.leaveRequest.groupBy({
      by: ['leaveTypeId'],
      where: { status: 'APPROVED', startDate: { gte: dbDate(`${year}-01-01`), lte: dbDate(`${year}-12-31`) } },
      _sum: { days: true },
    }),
    prisma.leaveType.findMany({ select: { id: true, code: true, name: true, color: true } }),
    prisma.leaveRequest.findMany({
      where: { status: 'APPROVED', startDate: { lte: dbDate(todayStr) }, endDate: { gte: dbDate(todayStr) }, user: { deletedAt: null } },
      select: {
        id: true,
        endDate: true,
        leaveType: { select: { name: true } },
        user: { select: { id: true, name: true, avatarUrl: true, department: { select: { name: true } } } },
      },
      orderBy: { endDate: 'asc' },
      take: 12,
    }),
    prisma.user.findMany({ where: { status: 'PENDING', deletedAt: null }, select: rowSelect, orderBy: { createdAt: 'asc' }, take: 6 }),
    Promise.all([
      prisma.leaveRequest.count({ where: { status: 'PENDING', userId: { not: actor.id } } }),
      prisma.regularizationRequest.count({ where: { status: 'PENDING', userId: { not: actor.id } } }),
      prisma.user.count({ where: { status: 'PENDING', deletedAt: null } }),
      prisma.attendance.count({ where: { isFlagged: true } }),
    ]),
  ]);

  const deptOf = new Map(people.map((p) => [p.id, p.departmentId]));
  const t = tally(today);
  const expected = t.present + t.late + t.absent + t.notIn;
  const typeById = new Map(leaveTypes.map((lt) => [lt.id, lt]));

  return {
    headcount: ids.length,
    today: { ...t, rate: expected ? Math.round(((t.present + t.late) / expected) * 100) : 0 },
    trend: series,
    departments: departments
      .map((d) => {
        const rows = today.filter((r) => deptOf.get(r.userId) === d.id);
        const dt = tally(rows);
        return { id: d.id, name: d.name, headcount: rows.length, present: dt.present, late: dt.late, absent: dt.absent, onLeave: dt.onLeave, notIn: dt.notIn };
      })
      .filter((d) => d.headcount > 0),
    leaveByType: leaveSums
      .map((s) => {
        const lt = typeById.get(s.leaveTypeId)!;
        return { code: lt.code, name: lt.name, color: lt.color, days: s._sum.days ?? 0 };
      })
      .sort((a, b) => b.days - a.days),
    onLeaveToday: onLeave.map((l) => ({
      id: l.user.id,
      name: l.user.name,
      avatarUrl: l.user.avatarUrl,
      leaveType: l.leaveType.name,
      until: dateStr(l.endDate),
      department: l.user.department?.name ?? null,
    })),
    pendingAccounts: pendingAccounts.map(toRow),
    pendingCounts: { leave: counts[0], regularization: counts[1], accounts: counts[2], flagged: counts[3] },
  };
}
