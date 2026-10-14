/**
 * Seeds a plausible Dhaka software company: departments, shifts, Bangladeshi
 * holidays, leave types, ~24 people across four roles, and attendance history
 * from 1 August to yesterday generated through the real attendance engine.
 *
 * All people and data are fictional.
 */
import { PrismaClient, type Prisma, type Role, type Shift } from '@prisma/client';
import argon2 from 'argon2';
import { addDaysStr, dbDate, eachDate, localDate, zonedInstant, fromHHmm } from '../src/lib/time';
import { evaluate } from '../src/modules/attendance/engine';
import { isOffDay } from '../src/lib/schedule';

const prisma = new PrismaClient();
const TZ = process.env.OFFICE_TIMEZONE ?? 'Asia/Dhaka';
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@hajira.test';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345';
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? 'Demo@12345';
const HISTORY_FROM = '2026-08-01';

// Deterministic PRNG so every seed produces the same history.
let state = 20260801;
const rand = () => {
  state = (state * 1664525 + 1013904223) % 4294967296;
  return state / 4294967296;
};
const between = (min: number, max: number) => Math.round(min + rand() * (max - min));

const hash = (p: string) => argon2.hash(p, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });

async function reset() {
  // Order matters for foreign keys.
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.latePenalty.deleteMany(),
    prisma.regularizationRequest.deleteMany(),
    prisma.leaveApproval.deleteMany(),
    prisma.leaveRequest.deleteMany(),
    prisma.leaveBalance.deleteMany(),
    prisma.attendance.deleteMany(),
    prisma.employeeShift.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.verificationToken.deleteMany(),
    prisma.user.updateMany({ data: { managerId: null } }),
    prisma.department.updateMany({ data: { headId: null, defaultShiftId: null } }),
    prisma.user.deleteMany(),
    prisma.designation.deleteMany(),
    prisma.department.deleteMany(),
    prisma.shift.deleteMany(),
    prisma.leaveType.deleteMany(),
    prisma.holiday.deleteMany(),
    prisma.setting.deleteMany(),
  ]);
}

async function main() {
  console.log('Resetting data…');
  await reset();

  // ---------- shifts ----------
  const shiftData = [
    { name: 'General', type: 'FIXED' as const, start: '09:00', end: '18:00', grace: 15, isDefault: true },
    { name: 'Early', type: 'FIXED' as const, start: '08:00', end: '17:00', grace: 10, isDefault: false },
    { name: 'Night support', type: 'NIGHT' as const, start: '22:00', end: '06:00', grace: 15, isDefault: false },
    { name: 'Flexible', type: 'FLEXIBLE' as const, start: '10:00', end: '19:00', grace: 0, isDefault: false },
  ];
  const shifts: Record<string, Shift> = {};
  for (const s of shiftData) {
    shifts[s.name] = await prisma.shift.create({
      data: {
        name: s.name,
        type: s.type,
        startMinutes: fromHHmm(s.start),
        endMinutes: fromHHmm(s.end),
        graceMinutes: s.grace,
        earlyLeaveGraceMinutes: 10,
        halfDayMinutes: 240,
        weeklyOffDays: [5, 6], // Friday + Saturday
        isDefault: s.isDefault,
      },
    });
  }

  // ---------- departments & designations ----------
  const deptData = [
    { name: 'Engineering', code: 'ENG', description: 'Product engineering and platform', shift: 'General', titles: ['Engineering Manager', 'Senior Software Engineer', 'Software Engineer', 'QA Engineer'] },
    { name: 'Product & Design', code: 'PD', description: 'Product management and UX', shift: 'Flexible', titles: ['Product Manager', 'Product Designer'] },
    { name: 'Sales', code: 'SALES', description: 'Business development and accounts', shift: 'General', titles: ['Sales Lead', 'Account Executive'] },
    { name: 'Operations', code: 'OPS', description: 'Customer support and service operations', shift: 'Early', titles: ['Operations Manager', 'Support Specialist', 'Night Support Engineer'] },
    { name: 'Finance & Accounts', code: 'FIN', description: 'Accounting, payroll and compliance', shift: 'General', titles: ['Accountant'] },
    { name: 'Human Resources', code: 'HR', description: 'People operations', shift: 'General', titles: ['HR Manager', 'HR Executive'] },
    { name: 'Administration', code: 'ADM', description: 'Office and systems administration', shift: 'General', titles: ['Systems Administrator'] },
  ];
  const depts: Record<string, string> = {};
  const titles: Record<string, string> = {};
  for (const d of deptData) {
    const dept = await prisma.department.create({
      data: { name: d.name, code: d.code, description: d.description, defaultShiftId: shifts[d.shift].id },
    });
    depts[d.code] = dept.id;
    for (const [i, t] of d.titles.entries()) {
      const des = await prisma.designation.create({ data: { title: t, departmentId: dept.id, level: i + 1 } });
      titles[t] = des.id;
    }
  }
  titles['Intern'] = (await prisma.designation.create({ data: { title: 'Intern', level: 9 } })).id;

  // ---------- leave types (Bangladesh Labour Act conventions) ----------
  const leaveTypeData = [
    { name: 'Casual leave', code: 'CL', quota: 10, color: '#D55181', maxConsecutive: 3, carry: false, maxCarry: 0, attach: null },
    { name: 'Sick leave', code: 'SL', quota: 14, color: '#1F9FD0', maxConsecutive: 14, carry: false, maxCarry: 0, attach: 2 },
    { name: 'Annual leave', code: 'AL', quota: 16, color: '#4457C9', maxConsecutive: 15, carry: true, maxCarry: 40, attach: null },
    { name: 'Maternity leave', code: 'ML', quota: 112, color: '#7C829C', maxConsecutive: 112, carry: false, maxCarry: 0, attach: 1 },
    { name: 'Paternity leave', code: 'PL', quota: 5, color: '#7C829C', maxConsecutive: 5, carry: false, maxCarry: 0, attach: null },
    { name: 'Unpaid leave', code: 'UL', quota: 0, color: '#7C829C', maxConsecutive: 30, carry: false, maxCarry: 0, attach: null, unpaid: true },
  ];
  const leaveTypes: Record<string, { id: string; name: string }> = {};
  for (const t of leaveTypeData) {
    const lt = await prisma.leaveType.create({
      data: {
        name: t.name,
        code: t.code,
        yearlyQuota: t.quota,
        isPaid: !('unpaid' in t),
        carryForward: t.carry,
        maxCarryForward: t.maxCarry,
        maxConsecutiveDays: t.maxConsecutive,
        allowHalfDay: t.code === 'CL' || t.code === 'SL' || t.code === 'AL' || t.code === 'UL',
        requiresAttachmentAfterDays: t.attach,
        color: t.color,
      },
    });
    leaveTypes[t.code] = lt;
  }

  // ---------- holidays ----------
  // Lunar holidays depend on moon sighting; dates are the expected ones.
  const tentative = 'Expected date; depends on moon sighting. Confirm against the government notice.';
  const holidays = [
    ['2026-02-21', 'Shaheed Dibosh & International Mother Language Day', 'PUBLIC', null],
    ['2026-03-20', 'Eid-ul-Fitr', 'PUBLIC', tentative],
    ['2026-03-21', 'Eid-ul-Fitr holiday', 'PUBLIC', tentative],
    ['2026-03-22', 'Eid-ul-Fitr holiday', 'PUBLIC', tentative],
    ['2026-03-26', 'Independence Day', 'PUBLIC', null],
    ['2026-04-14', 'Pahela Baishakh (Bengali New Year)', 'PUBLIC', null],
    ['2026-05-01', 'May Day', 'PUBLIC', null],
    ['2026-05-26', 'Eid-ul-Adha holiday', 'PUBLIC', tentative],
    ['2026-05-27', 'Eid-ul-Adha', 'PUBLIC', tentative],
    ['2026-05-28', 'Eid-ul-Adha holiday', 'PUBLIC', tentative],
    ['2026-06-26', 'Ashura', 'PUBLIC', tentative],
    ['2026-08-05', 'July Mass Uprising Day', 'PUBLIC', null],
    ['2026-08-26', 'Eid-e-Miladunnabi', 'PUBLIC', tentative],
    ['2026-09-04', 'Janmashtami', 'PUBLIC', tentative],
    ['2026-09-10', 'Company Foundation Day', 'COMPANY', 'Office closed for the annual company day.'],
    ['2026-10-21', 'Durga Puja (Bijoya Dashami)', 'PUBLIC', tentative],
    ['2026-12-16', 'Victory Day', 'PUBLIC', null],
    ['2026-12-25', 'Christmas Day', 'PUBLIC', null],
    ['2027-02-21', 'Shaheed Dibosh & International Mother Language Day', 'PUBLIC', null],
  ] as const;
  await prisma.holiday.createMany({
    data: holidays.map(([date, name, type, description]) => ({ date: dbDate(date), name, type, description })),
  });
  const holidaySet = new Set<string>(holidays.map((h) => h[0]));

  // ---------- people ----------
  const adminHash = await hash(ADMIN_PASSWORD);
  const demoHash = await hash(DEMO_PASSWORD);
  let code = 0;
  const nextCode = () => `HJ-${String(++code).padStart(4, '0')}`;

  interface Person {
    key: string;
    name: string;
    email: string;
    role: Role;
    dept: string;
    title: string;
    manager?: string;
    shift?: string;
    phone: string;
    joined: string;
    punctuality?: number; // 0 (always late) … 1 (never late)
  }
  const people: Person[] = [
    { key: 'admin', name: 'Arif Hossain', email: ADMIN_EMAIL, role: 'ADMIN', dept: 'ADM', title: 'Systems Administrator', phone: '01711000001', joined: '2021-01-10', punctuality: 0.97 },
    { key: 'hr', name: 'Sharmin Akter', email: 'hr@hajira.test', role: 'HR', dept: 'HR', title: 'HR Manager', phone: '01711000002', joined: '2021-03-01', punctuality: 0.95 },
    { key: 'hr2', name: 'Mehedi Hasan', email: 'mehedi.hasan@hajira.test', role: 'HR', dept: 'HR', title: 'HR Executive', manager: 'hr', phone: '01811000003', joined: '2023-07-16', punctuality: 0.9 },
    { key: 'manager', name: 'Tanvir Hasan', email: 'manager@hajira.test', role: 'MANAGER', dept: 'ENG', title: 'Engineering Manager', phone: '01711000004', joined: '2021-06-20', punctuality: 0.92 },
    { key: 'employee', name: 'Nusrat Jahan', email: 'employee@hajira.test', role: 'EMPLOYEE', dept: 'ENG', title: 'Software Engineer', manager: 'manager', phone: '01911000005', joined: '2024-02-04', punctuality: 0.85 },
    { key: 'e1', name: 'Rafiul Islam', email: 'rafiul.islam@hajira.test', role: 'EMPLOYEE', dept: 'ENG', title: 'Senior Software Engineer', manager: 'manager', phone: '01711000006', joined: '2022-01-09', punctuality: 0.9 },
    { key: 'e2', name: 'Sadia Afrin', email: 'sadia.afrin@hajira.test', role: 'EMPLOYEE', dept: 'ENG', title: 'Software Engineer', manager: 'manager', phone: '01611000007', joined: '2023-05-14', punctuality: 0.8 },
    { key: 'e3', name: 'Mahmudul Hasan', email: 'mahmudul.hasan@hajira.test', role: 'EMPLOYEE', dept: 'ENG', title: 'Software Engineer', manager: 'manager', phone: '01511000008', joined: '2024-09-01', punctuality: 0.65 },
    { key: 'e4', name: 'Tasnim Ferdous', email: 'tasnim.ferdous@hajira.test', role: 'EMPLOYEE', dept: 'ENG', title: 'QA Engineer', manager: 'manager', phone: '01311000009', joined: '2023-11-12', punctuality: 0.88 },
    { key: 'e5', name: 'Ashikur Rahman', email: 'ashikur.rahman@hajira.test', role: 'EMPLOYEE', dept: 'ENG', title: 'Intern', manager: 'manager', phone: '01711000010', joined: '2026-07-01', punctuality: 0.75 },
    { key: 'pm', name: 'Farzana Yasmin', email: 'farzana.yasmin@hajira.test', role: 'MANAGER', dept: 'PD', title: 'Product Manager', phone: '01711000011', joined: '2022-04-03', punctuality: 0.93 },
    { key: 'e6', name: 'Zarif Ahmed', email: 'zarif.ahmed@hajira.test', role: 'EMPLOYEE', dept: 'PD', title: 'Product Designer', manager: 'pm', phone: '01811000012', joined: '2023-02-19', punctuality: 0.9 },
    { key: 'e7', name: 'Lamia Siddiqua', email: 'lamia.siddiqua@hajira.test', role: 'EMPLOYEE', dept: 'PD', title: 'Product Designer', manager: 'pm', phone: '01911000013', joined: '2025-01-05', punctuality: 0.92 },
    { key: 'sales', name: 'Rumana Chowdhury', email: 'rumana.chowdhury@hajira.test', role: 'MANAGER', dept: 'SALES', title: 'Sales Lead', phone: '01711000014', joined: '2021-09-12', punctuality: 0.88 },
    { key: 'e8', name: 'Shakil Ahmed', email: 'shakil.ahmed@hajira.test', role: 'EMPLOYEE', dept: 'SALES', title: 'Account Executive', manager: 'sales', phone: '01611000015', joined: '2023-08-20', punctuality: 0.7 },
    { key: 'e9', name: 'Nabila Karim', email: 'nabila.karim@hajira.test', role: 'EMPLOYEE', dept: 'SALES', title: 'Account Executive', manager: 'sales', phone: '01511000016', joined: '2024-03-10', punctuality: 0.86 },
    { key: 'ops', name: 'Imran Kabir', email: 'imran.kabir@hajira.test', role: 'MANAGER', dept: 'OPS', title: 'Operations Manager', phone: '01711000017', joined: '2021-11-01', punctuality: 0.94 },
    { key: 'e10', name: 'Jannatul Ferdous', email: 'jannatul.ferdous@hajira.test', role: 'EMPLOYEE', dept: 'OPS', title: 'Support Specialist', manager: 'ops', phone: '01811000018', joined: '2022-10-02', punctuality: 0.9 },
    { key: 'e11', name: 'Habibur Rahman', email: 'habibur.rahman@hajira.test', role: 'EMPLOYEE', dept: 'OPS', title: 'Support Specialist', manager: 'ops', phone: '01911000019', joined: '2024-05-26', punctuality: 0.78 },
    { key: 'e12', name: 'Sabbir Hossain', email: 'sabbir.hossain@hajira.test', role: 'EMPLOYEE', dept: 'OPS', title: 'Night Support Engineer', manager: 'ops', shift: 'Night support', phone: '01311000020', joined: '2023-04-16', punctuality: 0.9 },
    { key: 'e13', name: 'Moumita Das', email: 'moumita.das@hajira.test', role: 'EMPLOYEE', dept: 'OPS', title: 'Night Support Engineer', manager: 'ops', shift: 'Night support', phone: '01711000021', joined: '2025-03-02', punctuality: 0.85 },
    { key: 'e14', name: 'Kamrul Islam', email: 'kamrul.islam@hajira.test', role: 'EMPLOYEE', dept: 'FIN', title: 'Accountant', manager: 'hr', phone: '01611000022', joined: '2022-06-05', punctuality: 0.95 },
    { key: 'e15', name: 'Afsana Mimi', email: 'afsana.mimi@hajira.test', role: 'EMPLOYEE', dept: 'FIN', title: 'Accountant', manager: 'hr', phone: '01511000023', joined: '2024-12-01', punctuality: 0.88 },
  ];

  const ids: Record<string, string> = {};
  for (const p of people) {
    const u = await prisma.user.create({
      data: {
        employeeCode: nextCode(),
        name: p.name,
        email: p.email,
        phone: p.phone,
        role: p.role,
        status: 'ACTIVE',
        isSuperAdmin: p.key === 'admin',
        emailVerifiedAt: new Date(),
        passwordHash: p.key === 'admin' ? adminHash : demoHash,
        departmentId: depts[p.dept],
        designationId: titles[p.title],
        joinDate: dbDate(p.joined),
        address: 'Dhaka, Bangladesh',
      },
    });
    ids[p.key] = u.id;
  }
  for (const p of people) {
    if (p.manager) await prisma.user.update({ where: { id: ids[p.key] }, data: { managerId: ids[p.manager] } });
    if (p.shift) {
      await prisma.employeeShift.create({ data: { userId: ids[p.key], shiftId: shifts[p.shift].id, effectiveFrom: dbDate(p.joined) } });
    }
  }
  const heads: Record<string, string> = { ENG: 'manager', PD: 'pm', SALES: 'sales', OPS: 'ops', HR: 'hr', ADM: 'admin', FIN: 'hr' };
  for (const [dept, key] of Object.entries(heads)) await prisma.department.update({ where: { id: depts[dept] }, data: { headId: ids[key] } });

  // Two registrations waiting for HR, so the approval queue is not empty.
  await prisma.user.createMany({
    data: [
      { name: 'Riyad Mahmud', email: 'riyad.mahmud@example.com', phone: '01711000031', status: 'PENDING', emailVerifiedAt: new Date(), passwordHash: demoHash, departmentId: depts.ENG, designationId: titles['Software Engineer'] },
      { name: 'Sumaiya Islam', email: 'sumaiya.islam@example.com', phone: '01811000032', status: 'PENDING', emailVerifiedAt: new Date(), passwordHash: demoHash, departmentId: depts.SALES, designationId: titles['Account Executive'] },
    ],
  });

  // ---------- balances ----------
  const year = 2026;
  for (const p of people) {
    await prisma.leaveBalance.createMany({
      data: Object.values(leaveTypes).map((lt) => {
        const t = leaveTypeData.find((x) => x.name === lt.name)!;
        return { userId: ids[p.key], leaveTypeId: lt.id, year, allocated: t.quota, carriedForward: t.carry ? between(2, 9) : 0 };
      }),
    });
  }

  // ---------- leave requests ----------
  const now = new Date();
  const today = localDate(now, TZ);
  const approvedDays = new Map<string, Set<string>>(); // userId -> dates on leave

  async function leave(
    who: string,
    code: string,
    start: string,
    end: string,
    status: 'APPROVED' | 'PENDING' | 'REJECTED',
    reason: string,
    opts: { managerApproved?: boolean; comment?: string } = {},
  ) {
    const userId = ids[who];
    const person = people.find((p) => p.key === who)!;
    const shift = shifts[person.shift ?? deptData.find((d) => d.code === person.dept)!.shift];
    const working = eachDate(start, end).filter((d) => !holidaySet.has(d) && !isOffDay(shift, d));
    const days = working.length;
    const hasManager = Boolean(person.manager);
    const approver = person.manager ? ids[person.manager] : null;
    const created = await prisma.leaveRequest.create({
      data: {
        userId,
        leaveTypeId: leaveTypes[code].id,
        startDate: dbDate(start),
        endDate: dbDate(end),
        days,
        reason,
        status,
        currentLevel: status === 'PENDING' && (opts.managerApproved || !hasManager) ? 2 : status === 'PENDING' ? 1 : 2,
        createdAt: new Date(`${addDaysStr(start, -6)}T04:00:00Z`),
        approvals: {
          create: [
            {
              level: 1,
              approverRole: 'MANAGER',
              approverId: hasManager && (status !== 'PENDING' || opts.managerApproved) ? approver : null,
              decision: !hasManager ? 'SKIPPED' : status === 'PENDING' && !opts.managerApproved ? 'PENDING' : status === 'REJECTED' ? 'REJECTED' : 'APPROVED',
              comment: status === 'REJECTED' ? opts.comment ?? 'Release week; please move this by a few days.' : null,
              decidedAt: hasManager && (status !== 'PENDING' || opts.managerApproved) ? new Date(`${addDaysStr(start, -5)}T05:00:00Z`) : null,
            },
            {
              level: 2,
              approverRole: 'HR',
              approverId: status === 'APPROVED' ? ids.hr : null,
              decision: status === 'APPROVED' ? 'APPROVED' : status === 'REJECTED' ? 'SKIPPED' : 'PENDING',
              decidedAt: status === 'APPROVED' ? new Date(`${addDaysStr(start, -4)}T06:00:00Z`) : null,
            },
          ],
        },
      },
    });
    if (status === 'APPROVED') {
      await prisma.leaveBalance.update({
        where: { userId_leaveTypeId_year: { userId, leaveTypeId: leaveTypes[code].id, year } },
        data: { used: { increment: days } },
      });
      const set = approvedDays.get(userId) ?? new Set<string>();
      working.forEach((d) => set.add(d));
      approvedDays.set(userId, set);
    }
    return created;
  }

  await leave('employee', 'CL', '2026-10-07', '2026-10-07', 'APPROVED', 'Family event in Mymensingh');
  await leave('employee', 'SL', '2026-08-18', '2026-08-19', 'APPROVED', 'Fever, resting at home');
  await leave('employee', 'AL', '2026-10-25', '2026-10-28', 'PENDING', 'Trip to Sylhet with family');
  await leave('e1', 'AL', '2026-09-13', '2026-09-17', 'APPROVED', 'Annual vacation to Cox’s Bazar');
  await leave('e2', 'CL', '2026-10-15', '2026-10-15', 'PENDING', 'Bank and passport office errands');
  await leave('e3', 'SL', '2026-10-12', '2026-10-13', 'APPROVED', 'Dental surgery recovery');
  await leave('e3', 'CL', '2026-10-19', '2026-10-20', 'PENDING', 'Sister’s wedding preparations', { managerApproved: true });
  await leave('e4', 'CL', '2026-09-28', '2026-09-29', 'REJECTED', 'Personal work');
  await leave('e6', 'AL', '2026-10-13', '2026-10-16', 'APPROVED', 'Visiting grandparents in Rajshahi');
  await leave('e8', 'CL', '2026-08-24', '2026-08-24', 'APPROVED', 'Child’s school admission');
  await leave('e9', 'SL', '2026-10-14', '2026-10-14', 'APPROVED', 'Migraine');
  await leave('e10', 'AL', '2026-09-20', '2026-09-24', 'APPROVED', 'Umrah');
  await leave('e11', 'UL', '2026-10-22', '2026-10-23', 'PENDING', 'Moving house');
  await leave('e14', 'CL', '2026-10-01', '2026-10-01', 'APPROVED', 'Utility connection at new flat');
  await leave('e15', 'SL', '2026-10-27', '2026-10-27', 'PENDING', 'Doctor appointment');

  // ---------- attendance history ----------
  console.log('Generating attendance history…');
  const yesterday = addDaysStr(today, -1);
  const rows: Prisma.AttendanceCreateManyInput[] = [];
  let flaggedFor: { userId: string; date: string } | null = null;

  for (const p of people) {
    const userId = ids[p.key];
    const shift = shifts[p.shift ?? deptData.find((d) => d.code === p.dept)!.shift];
    const onLeave = approvedDays.get(userId) ?? new Set<string>();
    const from = p.joined > HISTORY_FROM ? p.joined : HISTORY_FROM;
    const punctual = p.punctuality ?? 0.85;

    for (const date of eachDate(from, yesterday)) {
      const holiday = holidaySet.has(date);
      const off = isOffDay(shift, date);
      const ctx = { date, shift, tz: TZ, isOffDay: off, isHoliday: holiday, halfDayLeave: null };
      const base = { userId, date: dbDate(date), shiftId: shift.id };
      if (holiday || off) {
        rows.push({ ...base, status: holiday ? 'HOLIDAY' : 'WEEKEND' });
        continue;
      }
      if (onLeave.has(date)) {
        rows.push({ ...base, status: 'ON_LEAVE' });
        continue;
      }
      const roll = rand();
      if (roll < 0.035) {
        rows.push({ ...base, status: 'ABSENT' });
        continue;
      }
      const late = rand() > punctual;
      const startMin = shift.startMinutes + (late ? between(shift.graceMinutes + 2, 70) : between(-25, shift.graceMinutes - 2));
      const halfDay = roll > 0.985;
      const endMin = halfDay
        ? shift.startMinutes + between(150, 220)
        : shift.startMinutes + (shift.endMinutes > shift.startMinutes ? shift.endMinutes - shift.startMinutes : shift.endMinutes + 1440 - shift.startMinutes) + between(-5, 75);
      const checkIn = zonedInstant(date, startMin, TZ);
      const checkOut = zonedInstant(date, endMin, TZ);
      const result = evaluate(ctx, checkIn, checkOut);
      rows.push({ ...base, checkIn, checkOut, ...result });
    }
  }

  // One forgotten check-out last week for the demo employee's teammate: auto-closed and flagged.
  const flagDate = eachDate(addDaysStr(today, -6), addDaysStr(today, -2)).find((d) => !holidaySet.has(d) && !isOffDay(shifts.General, d));
  if (flagDate) {
    const idx = rows.findIndex((r) => r.userId === ids.e2 && (r.date as Date).getTime() === dbDate(flagDate).getTime() && r.checkIn);
    if (idx >= 0) {
      const r = rows[idx];
      const end = zonedInstant(flagDate, shifts.General.endMinutes, TZ);
      const res = evaluate({ date: flagDate, shift: shifts.General, tz: TZ, isOffDay: false, isHoliday: false, halfDayLeave: null }, r.checkIn as Date, end);
      rows[idx] = { ...r, checkOut: end, ...res, autoClosed: true, isFlagged: true, flagReason: 'Missing check-out: closed at shift end' };
      flaggedFor = { userId: ids.e2, date: flagDate };
    }
  }

  // Today: people who already arrived (never the demo employee, so they can press Check in).
  for (const p of people) {
    if (p.key === 'employee' || p.shift === 'Night support') continue;
    const userId = ids[p.key];
    if (approvedDays.get(userId)?.has(today)) continue;
    const shift = shifts[deptData.find((d) => d.code === p.dept)!.shift];
    if (holidaySet.has(today) || isOffDay(shift, today)) continue;
    if (rand() < 0.12) continue; // not in yet
    const late = rand() > (p.punctuality ?? 0.85);
    const checkIn = zonedInstant(today, shift.startMinutes + (late ? between(shift.graceMinutes + 3, 55) : between(-25, shift.graceMinutes - 2)), TZ);
    if (checkIn > now) continue;
    const result = evaluate({ date: today, shift, tz: TZ, isOffDay: false, isHoliday: false, halfDayLeave: null }, checkIn, null);
    rows.push({ userId, date: dbDate(today), shiftId: shift.id, checkIn, ...result });
  }

  for (let i = 0; i < rows.length; i += 1000) {
    await prisma.attendance.createMany({ data: rows.slice(i, i + 1000) });
  }
  console.log(`  ${rows.length} attendance records`);

  // A pending correction for the flagged day.
  if (flaggedFor) {
    const att = await prisma.attendance.findUnique({ where: { userId_date: { userId: flaggedFor.userId, date: dbDate(flaggedFor.date) } } });
    await prisma.regularizationRequest.create({
      data: {
        userId: flaggedFor.userId,
        attendanceId: att?.id,
        date: dbDate(flaggedFor.date),
        requestedCheckOut: zonedInstant(flaggedFor.date, fromHHmm('19:40'), TZ),
        reason: 'Stayed late for the release deployment and forgot to check out before leaving.',
      },
    });
  }

  // ---------- notifications for the demo employee ----------
  await prisma.notification.createMany({
    data: [
      { userId: ids.employee, type: 'LEAVE_STATUS', title: 'Leave approved', body: '1 day of casual leave, Wed 7 Oct 2026', link: '/leave', createdAt: new Date(`2026-10-03T06:00:00Z`) },
      { userId: ids.employee, type: 'GENERAL', title: 'Durga Puja holiday', body: 'The office is closed on Wed 21 Oct for Bijoya Dashami.', link: '/holidays', createdAt: new Date(`2026-10-10T04:00:00Z`) },
      { userId: ids.manager, type: 'LEAVE_REQUEST', title: 'Sadia Afrin requested leave', body: '1 day of casual leave, Thu 15 Oct 2026', link: '/approvals' },
      { userId: ids.manager, type: 'REGULARIZATION', title: 'Sadia Afrin asked for an attendance correction', body: 'Forgot to check out after the release.', link: '/approvals?tab=regularization' },
    ],
  });

  // ---------- settings ----------
  await prisma.setting.createMany({
    data: [
      { key: 'timezone', value: TZ },
      { key: 'ipRestriction', value: { enabled: false, allowedIps: ['103.48.16.*'] } },
      { key: 'latePolicy', value: { enabled: true, lateMarksPerDeduction: 3, deductLeaveTypeCode: 'CL' } },
      { key: 'approvalFlow', value: { levels: ['MANAGER', 'HR'] } },
      { key: 'autoCloseAfterMinutes', value: 120 },
    ],
  });

  console.log('\nSeed complete. Sign in with:');
  console.log(`  Super admin  ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`  HR           hr@hajira.test / ${DEMO_PASSWORD}`);
  console.log(`  Manager      manager@hajira.test / ${DEMO_PASSWORD}`);
  console.log(`  Employee     employee@hajira.test / ${DEMO_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
