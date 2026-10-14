import type {
  ApprovalDecision,
  ApproverRole,
  AttendanceStatus,
  HalfDaySession,
  HolidayType,
  LeaveStatus,
  NotificationType,
  RequestStatus,
  Role,
  ShiftType,
  UserStatus,
} from './enums';

// ---------- envelope ----------

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
  meta?: PageMeta;
}

export interface ApiErrorBody {
  success: false;
  data: null;
  message: string;
  code?: string;
  errors?: Record<string, string[]>;
}

// ---------- entities ----------

export interface Ref {
  id: string;
  name: string;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  isSuperAdmin: boolean;
  avatarUrl: string | null;
  emailVerified: boolean;
  department: Ref | null;
  designation: { id: string; title: string } | null;
  employeeCode: string | null;
  hasReports: boolean;
}

export interface UserRow {
  id: string;
  employeeCode: string | null;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  status: UserStatus;
  avatarUrl: string | null;
  joinDate: string | null;
  emailVerified: boolean;
  department: Ref | null;
  designation: { id: string; title: string } | null;
  manager: Ref | null;
  createdAt: string;
}

export interface UserDetail extends UserRow {
  address: string | null;
  emergencyContact: string | null;
  dateOfBirth: string | null;
  isSuperAdmin: boolean;
  currentShift: ShiftDto | null;
  lastLoginAt: string | null;
}

export interface DepartmentDto {
  id: string;
  name: string;
  code: string;
  description: string | null;
  head: Ref | null;
  defaultShift: { id: string; name: string } | null;
  employeeCount: number;
  createdAt: string;
}

export interface DesignationDto {
  id: string;
  title: string;
  level: number | null;
  department: Ref | null;
  employeeCount: number;
}

export interface ShiftDto {
  id: string;
  name: string;
  type: ShiftType;
  startTime: string;
  endTime: string;
  graceMinutes: number;
  earlyLeaveGraceMinutes: number;
  halfDayMinutes: number;
  weeklyOffDays: number[];
  isDefault: boolean;
  assignedCount?: number;
}

export interface AttendanceDto {
  id: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: AttendanceStatus;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  workMinutes: number;
  overtimeMinutes: number;
  isFlagged: boolean;
  flagReason: string | null;
  autoClosed: boolean;
  note: string | null;
  user?: { id: string; name: string; avatarUrl: string | null; employeeCode: string | null; department: Ref | null };
}

export interface TodayDto {
  date: string;
  serverTime: string;
  timezone: string;
  shift: ShiftDto | null;
  /** UTC instants for today's shift window. */
  window: { start: string; graceEnd: string; end: string } | null;
  dayType: 'WORKDAY' | 'WEEKEND' | 'HOLIDAY' | 'LEAVE';
  holiday: { name: string } | null;
  leave: { type: string; isHalfDay: boolean } | null;
  attendance: AttendanceDto | null;
  canCheckIn: boolean;
  canCheckOut: boolean;
  ipAllowed: boolean;
}

export interface MonthDay {
  date: string;
  status: AttendanceStatus | null;
  /** Pending items render dashed: the stitch is not pulled tight yet. */
  pending: boolean;
  isToday: boolean;
  isFuture: boolean;
  checkIn: string | null;
  checkOut: string | null;
  workMinutes: number;
  lateMinutes: number;
  label: string | null;
}

export interface MonthSummary {
  month: string;
  days: MonthDay[];
  totals: Record<AttendanceStatus, number> & { workingDays: number; workMinutes: number; overtimeMinutes: number };
}

export interface LeaveTypeDto {
  id: string;
  name: string;
  code: string;
  yearlyQuota: number;
  isPaid: boolean;
  carryForward: boolean;
  maxCarryForward: number;
  maxConsecutiveDays: number | null;
  allowHalfDay: boolean;
  requiresAttachmentAfterDays: number | null;
  color: string | null;
  isActive: boolean;
}

export interface LeaveBalanceDto {
  id: string;
  year: number;
  leaveType: { id: string; name: string; code: string; isPaid: boolean; color: string | null };
  allocated: number;
  carriedForward: number;
  adjusted: number;
  used: number;
  pending: number;
  available: number;
}

export interface LeaveApprovalDto {
  id: string;
  level: number;
  approverRole: ApproverRole;
  decision: ApprovalDecision;
  comment: string | null;
  decidedAt: string | null;
  approver: Ref | null;
}

export interface LeaveRequestDto {
  id: string;
  startDate: string;
  endDate: string;
  isHalfDay: boolean;
  halfDaySession: HalfDaySession | null;
  days: number;
  reason: string;
  attachmentUrl: string | null;
  status: LeaveStatus;
  currentLevel: number;
  createdAt: string;
  leaveType: { id: string; name: string; code: string; color: string | null };
  user: { id: string; name: string; avatarUrl: string | null; department: Ref | null; designation: string | null };
  approvals: LeaveApprovalDto[];
  /** True when the requesting viewer can act on the current approval level. */
  canDecide?: boolean;
}

export interface LeavePreviewDto {
  days: number;
  workingDates: string[];
  excluded: { date: string; reason: 'WEEKEND' | 'HOLIDAY'; label: string }[];
  balance: { available: number; afterApproval: number } | null;
  isPaid: boolean;
  attachmentRequired: boolean;
  problems: string[];
}

export interface CalendarEventDto {
  id: string;
  title: string;
  start: string;
  end: string;
  kind: 'LEAVE' | 'HOLIDAY';
  status?: LeaveStatus;
  color: string | null;
  user?: { id: string; name: string; avatarUrl: string | null };
  leaveType?: string;
  leaveTypeCode?: string;
  isHalfDay?: boolean;
}

export interface HolidayDto {
  id: string;
  name: string;
  date: string;
  type: HolidayType;
  description: string | null;
}

export interface RegularizationDto {
  id: string;
  date: string;
  requestedCheckIn: string | null;
  requestedCheckOut: string | null;
  reason: string;
  status: RequestStatus;
  reviewComment: string | null;
  reviewedAt: string | null;
  createdAt: string;
  reviewer: Ref | null;
  user: { id: string; name: string; avatarUrl: string | null; department: Ref | null };
  original: { checkIn: string | null; checkOut: string | null; status: AttendanceStatus | null } | null;
  canDecide?: boolean;
}

export interface NotificationDto {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface AuditLogDto {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  createdAt: string;
  actor: Ref | null;
}

export interface SettingsDto {
  timezone: string;
  ipRestriction: { enabled: boolean; allowedIps: string[] };
  latePolicy: { enabled: boolean; lateMarksPerDeduction: number; deductLeaveTypeCode: string };
  approvalFlow: { levels: ApproverRole[] };
  autoCloseAfterMinutes: number;
}

// ---------- dashboards ----------

export interface ActivityItem {
  id: string;
  kind: 'ATTENDANCE' | 'LEAVE' | 'REGULARIZATION' | 'NOTIFICATION';
  title: string;
  at: string;
  tone: 'present' | 'late' | 'absent' | 'leave' | 'holiday' | 'neutral';
}

export interface EmployeeDashboardDto {
  today: TodayDto;
  month: MonthSummary;
  balances: LeaveBalanceDto[];
  activity: ActivityItem[];
  lateMarks: { count: number; threshold: number | null };
}

export interface TeamMemberToday {
  id: string;
  name: string;
  avatarUrl: string | null;
  designation: string | null;
  status: AttendanceStatus | 'NOT_IN' | null;
  checkIn: string | null;
  lateMinutes: number;
}

export interface ManagerDashboardDto {
  team: { total: number; present: number; late: number; absent: number; onLeave: number; notIn: number };
  members: TeamMemberToday[];
  pending: { leave: LeaveRequestDto[]; regularization: RegularizationDto[] };
  trend: { date: string; present: number; late: number; absent: number; onLeave: number }[];
}

export interface AdminDashboardDto {
  headcount: number;
  today: { present: number; late: number; absent: number; onLeave: number; notIn: number; rate: number };
  trend: { date: string; present: number; late: number; absent: number; onLeave: number }[];
  departments: { id: string; name: string; headcount: number; present: number; late: number; absent: number; onLeave: number; notIn: number }[];
  leaveByType: { code: string; name: string; color: string | null; days: number }[];
  onLeaveToday: { id: string; name: string; avatarUrl: string | null; leaveType: string; until: string; department: string | null }[];
  pendingAccounts: UserRow[];
  pendingCounts: { leave: number; regularization: number; accounts: number; flagged: number };
}

// ---------- reports ----------

export interface MonthlySheetRow {
  user: { id: string; name: string; employeeCode: string | null; department: string | null };
  days: (AttendanceStatus | null)[];
  totals: { present: number; late: number; absent: number; halfDay: number; leave: number; holiday: number; weekend: number; workHours: number };
}

export interface MonthlySheetDto {
  month: string;
  dates: string[];
  rows: MonthlySheetRow[];
}

export interface LateReportRow {
  id: string;
  date: string;
  checkIn: string;
  lateMinutes: number;
  user: { id: string; name: string; employeeCode: string | null; department: string | null };
}

export interface LeaveReportRow {
  id: string;
  startDate: string;
  endDate: string;
  days: number;
  status: LeaveStatus;
  leaveType: string;
  user: { id: string; name: string; employeeCode: string | null; department: string | null };
}
