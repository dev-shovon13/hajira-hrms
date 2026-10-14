// Mirrors the Prisma enums so the client never imports @prisma/client.

export const ROLES = ['EMPLOYEE', 'MANAGER', 'HR', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const USER_STATUSES = ['PENDING', 'INVITED', 'ACTIVE', 'SUSPENDED', 'REJECTED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const ATTENDANCE_STATUSES = [
  'PRESENT',
  'LATE',
  'ABSENT',
  'HALF_DAY',
  'ON_LEAVE',
  'HOLIDAY',
  'WEEKEND',
] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const LEAVE_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

export const APPROVAL_DECISIONS = ['PENDING', 'APPROVED', 'REJECTED', 'SKIPPED'] as const;
export type ApprovalDecision = (typeof APPROVAL_DECISIONS)[number];

export const APPROVER_ROLES = ['MANAGER', 'HR'] as const;
export type ApproverRole = (typeof APPROVER_ROLES)[number];

export const REQUEST_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const HOLIDAY_TYPES = ['PUBLIC', 'COMPANY'] as const;
export type HolidayType = (typeof HOLIDAY_TYPES)[number];

export const SHIFT_TYPES = ['FIXED', 'NIGHT', 'FLEXIBLE'] as const;
export type ShiftType = (typeof SHIFT_TYPES)[number];

export const HALF_DAY_SESSIONS = ['FIRST_HALF', 'SECOND_HALF'] as const;
export type HalfDaySession = (typeof HALF_DAY_SESSIONS)[number];

export const NOTIFICATION_TYPES = [
  'LEAVE_STATUS',
  'LEAVE_REQUEST',
  'LATE_WARNING',
  'MISSING_CHECKOUT',
  'ACCOUNT_APPROVAL',
  'REGULARIZATION',
  'LATE_PENALTY',
  'GENERAL',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** Roles that can see and act on everything company-wide. */
export const HR_ROLES: readonly Role[] = ['HR', 'ADMIN'];
/** Roles that can approve team requests. */
export const APPROVER_ROLE_SET: readonly Role[] = ['MANAGER', 'HR', 'ADMIN'];

export const ROLE_LABELS: Record<Role, string> = {
  EMPLOYEE: 'Employee',
  MANAGER: 'Manager',
  HR: 'HR',
  ADMIN: 'Admin',
};

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: 'Present',
  LATE: 'Late',
  ABSENT: 'Absent',
  HALF_DAY: 'Half day',
  ON_LEAVE: 'On leave',
  HOLIDAY: 'Holiday',
  WEEKEND: 'Weekend',
};

/** Single-letter marks used on the monthly attendance sheet (and its exports). */
export const ATTENDANCE_STATUS_MARKS: Record<AttendanceStatus, string> = {
  PRESENT: 'P',
  LATE: 'L',
  ABSENT: 'A',
  HALF_DAY: 'H',
  ON_LEAVE: 'LV',
  HOLIDAY: 'HO',
  WEEKEND: 'W',
};
