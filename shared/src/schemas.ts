import { z } from 'zod';
import {
  ATTENDANCE_STATUSES,
  HALF_DAY_SESSIONS,
  HOLIDAY_TYPES,
  LEAVE_STATUSES,
  REQUEST_STATUSES,
  ROLES,
  SHIFT_TYPES,
  USER_STATUSES,
} from './enums';

// ---------- primitives ----------

/** YYYY-MM-DD calendar date (office-local). */
export const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD');

/** HH:mm 24h clock time. */
export const timeString = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour time, e.g. 09:00');

export const idString = z.string().min(1, 'Required');

export const strongPassword = z
  .string()
  .min(8, 'At least 8 characters')
  .max(72, 'At most 72 characters')
  .regex(/[a-z]/, 'Add a lowercase letter')
  .regex(/[A-Z]/, 'Add an uppercase letter')
  .regex(/\d/, 'Add a number')
  .regex(/[^A-Za-z0-9]/, 'Add a symbol');

/** Bangladeshi mobile numbers, with or without +880 / 880 / 0 prefix. */
export const bdPhone = z
  .string()
  .trim()
  .regex(/^(?:\+?880|0)1[3-9]\d{8}$/, 'Enter a valid Bangladeshi mobile number, e.g. 01712345678');

const email = z.string().trim().toLowerCase().email('Enter a valid email address');
const name = z.string().trim().min(2, 'At least 2 characters').max(80, 'At most 80 characters');

// ---------- pagination ----------

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().trim().optional(),
});
export type PaginationQuery = z.infer<typeof paginationQuery>;

// ---------- auth ----------

export const registerSchema = z
  .object({
    name,
    email,
    phone: bdPhone,
    password: strongPassword,
    confirmPassword: z.string(),
    departmentId: idString,
    designationId: idString,
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password'),
  remember: z.boolean().default(false),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10),
    password: strongPassword,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const acceptInviteSchema = resetPasswordSchema;
export type AcceptInviteInput = ResetPasswordInput;

export const verifyEmailSchema = z.object({ token: z.string().min(10) });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    password: strongPassword,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })
  .refine((v) => v.password !== v.currentPassword, {
    path: ['password'],
    message: 'Choose a password different from the current one',
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// ---------- users ----------

export const inviteUserSchema = z.object({
  name,
  email,
  phone: bdPhone.optional().or(z.literal('')),
  role: z.enum(ROLES).default('EMPLOYEE'),
  departmentId: idString,
  designationId: idString,
  managerId: z.string().optional().nullable(),
  shiftId: z.string().optional().nullable(),
});
export type InviteUserInput = z.infer<typeof inviteUserSchema>;

export const updateUserSchema = z.object({
  name: name.optional(),
  phone: bdPhone.optional(),
  role: z.enum(ROLES).optional(),
  status: z.enum(USER_STATUSES).optional(),
  departmentId: idString.optional(),
  designationId: idString.optional(),
  managerId: z.string().nullable().optional(),
  joinDate: dateString.optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const updateProfileSchema = z.object({
  name,
  phone: bdPhone,
  address: z.string().trim().max(200).optional().or(z.literal('')),
  emergencyContact: z.string().trim().max(120).optional().or(z.literal('')),
  dateOfBirth: dateString.optional().or(z.literal('')),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const approveAccountSchema = z.object({
  role: z.enum(ROLES).default('EMPLOYEE'),
  managerId: z.string().nullable().optional(),
  shiftId: z.string().nullable().optional(),
});
export type ApproveAccountInput = z.infer<typeof approveAccountSchema>;

export const userListQuery = paginationQuery.extend({
  status: z.enum(USER_STATUSES).optional(),
  role: z.enum(ROLES).optional(),
  departmentId: z.string().optional(),
});

// ---------- org ----------

export const departmentSchema = z.object({
  name: z.string().trim().min(2).max(60),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{2,10}$/, '2–10 letters, digits or dashes'),
  description: z.string().trim().max(200).optional().or(z.literal('')),
  headId: z.string().nullable().optional(),
  defaultShiftId: z.string().nullable().optional(),
});
export type DepartmentInput = z.infer<typeof departmentSchema>;

export const designationSchema = z.object({
  title: z.string().trim().min(2).max(60),
  departmentId: z.string().nullable().optional(),
  level: z.coerce.number().int().min(1).max(20).optional(),
});
export type DesignationInput = z.infer<typeof designationSchema>;

export const shiftSchema = z
  .object({
    name: z.string().trim().min(2).max(40),
    type: z.enum(SHIFT_TYPES),
    startTime: timeString,
    endTime: timeString,
    graceMinutes: z.coerce.number().int().min(0).max(120),
    earlyLeaveGraceMinutes: z.coerce.number().int().min(0).max(120).default(0),
    halfDayMinutes: z.coerce.number().int().min(60).max(720).default(240),
    weeklyOffDays: z.array(z.number().int().min(0).max(6)).max(6),
    isDefault: z.boolean().default(false),
  })
  .refine((v) => v.startTime !== v.endTime, {
    path: ['endTime'],
    message: 'End time must differ from start time',
  });
export type ShiftInput = z.infer<typeof shiftSchema>;

export const assignShiftSchema = z
  .object({
    userIds: z.array(z.string()).optional(),
    departmentId: z.string().optional(),
    effectiveFrom: dateString,
  })
  .refine((v) => (v.userIds && v.userIds.length > 0) || v.departmentId, {
    message: 'Choose employees or a department',
    path: ['userIds'],
  });
export type AssignShiftInput = z.infer<typeof assignShiftSchema>;

export const holidaySchema = z.object({
  name: z.string().trim().min(2).max(80),
  date: dateString,
  type: z.enum(HOLIDAY_TYPES),
  description: z.string().trim().max(200).optional().or(z.literal('')),
});
export type HolidayInput = z.infer<typeof holidaySchema>;

// ---------- attendance ----------

export const attendanceListQuery = paginationQuery.extend({
  from: dateString.optional(),
  to: dateString.optional(),
  status: z.enum(ATTENDANCE_STATUSES).optional(),
  departmentId: z.string().optional(),
  userId: z.string().optional(),
  flagged: z.enum(['true', 'false']).optional(),
});

export const monthQuery = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Use YYYY-MM')
    .optional(),
});

export const attendanceEditSchema = z.object({
  checkIn: z.string().datetime().nullable().optional(),
  checkOut: z.string().datetime().nullable().optional(),
  status: z.enum(ATTENDANCE_STATUSES).optional(),
  note: z.string().trim().min(3, 'Give a reason for the edit').max(300),
});
export type AttendanceEditInput = z.infer<typeof attendanceEditSchema>;

export const regularizationSchema = z
  .object({
    date: dateString,
    checkIn: timeString.optional().or(z.literal('')),
    checkOut: timeString.optional().or(z.literal('')),
    reason: z.string().trim().min(10, 'Explain what happened (10+ characters)').max(500),
  })
  .refine((v) => Boolean(v.checkIn) || Boolean(v.checkOut), {
    path: ['checkIn'],
    message: 'Enter the correct check-in, check-out, or both',
  });
export type RegularizationInput = z.infer<typeof regularizationSchema>;

export const reviewSchema = z.object({
  comment: z.string().trim().max(500).optional().or(z.literal('')),
});
export type ReviewInput = z.infer<typeof reviewSchema>;

export const rejectSchema = z.object({
  comment: z.string().trim().min(3, 'Tell them why').max(500),
});
export type RejectInput = z.infer<typeof rejectSchema>;

export const requestListQuery = paginationQuery.extend({
  status: z.enum(REQUEST_STATUSES).optional(),
  scope: z.enum(['mine', 'approvals', 'all']).default('mine'),
  userId: z.string().optional(),
  departmentId: z.string().optional(),
  from: dateString.optional(),
  to: dateString.optional(),
});

// ---------- leave ----------

export const leaveTypeSchema = z.object({
  name: z.string().trim().min(2).max(40),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2,5}$/, '2–5 letters'),
  yearlyQuota: z.coerce.number().min(0).max(365),
  isPaid: z.boolean().default(true),
  carryForward: z.boolean().default(false),
  maxCarryForward: z.coerce.number().min(0).max(365).default(0),
  maxConsecutiveDays: z.coerce.number().int().min(1).max(365).nullable().optional(),
  allowHalfDay: z.boolean().default(true),
  requiresAttachmentAfterDays: z.coerce.number().int().min(1).max(365).nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  isActive: z.boolean().default(true),
});
export type LeaveTypeInput = z.infer<typeof leaveTypeSchema>;

const leaveBase = z.object({
  leaveTypeId: idString,
  startDate: dateString,
  endDate: dateString,
  isHalfDay: z.boolean().default(false),
  halfDaySession: z.enum(HALF_DAY_SESSIONS).optional(),
});

export const leavePreviewSchema = leaveBase.refine((v) => v.endDate >= v.startDate, {
  path: ['endDate'],
  message: 'End date must be on or after the start date',
});
export type LeavePreviewInput = z.infer<typeof leavePreviewSchema>;

export const applyLeaveSchema = leaveBase
  .extend({
    reason: z.string().trim().min(5, 'Add a short reason').max(500),
    attachmentUrl: z
      .string()
      .max(500)
      .regex(/^(https:\/\/|\/uploads\/)/, 'Invalid attachment')
      .optional()
      .or(z.literal('')),
  })
  .refine((v) => v.endDate >= v.startDate, {
    path: ['endDate'],
    message: 'End date must be on or after the start date',
  })
  .refine((v) => !v.isHalfDay || v.startDate === v.endDate, {
    path: ['isHalfDay'],
    message: 'A half day must start and end on the same date',
  })
  .refine((v) => !v.isHalfDay || Boolean(v.halfDaySession), {
    path: ['halfDaySession'],
    message: 'Choose which half',
  });
export type ApplyLeaveInput = z.infer<typeof applyLeaveSchema>;

export const leaveListQuery = requestListQuery.extend({
  status: z.enum(LEAVE_STATUSES).optional(),
  leaveTypeId: z.string().optional(),
});

export const balanceAdjustSchema = z.object({
  userId: idString,
  leaveTypeId: idString,
  year: z.coerce.number().int().min(2000).max(2100),
  delta: z.coerce.number().min(-365).max(365),
  note: z.string().trim().min(3).max(200),
});
export type BalanceAdjustInput = z.infer<typeof balanceAdjustSchema>;

export const calendarQuery = z.object({
  from: dateString,
  to: dateString,
  departmentId: z.string().optional(),
});

// ---------- settings ----------

export const settingsSchema = z.object({
  timezone: z.string().min(3),
  ipRestriction: z.object({
    enabled: z.boolean(),
    allowedIps: z.array(z.string().trim().min(3)).max(50),
  }),
  latePolicy: z.object({
    enabled: z.boolean(),
    lateMarksPerDeduction: z.coerce.number().int().min(1).max(31),
    deductLeaveTypeCode: z.string().min(2).max(5),
  }),
  approvalFlow: z.object({
    levels: z.array(z.enum(['MANAGER', 'HR'])).min(1).max(2),
  }),
  autoCloseAfterMinutes: z.coerce.number().int().min(30).max(720),
});
export type SettingsInput = z.infer<typeof settingsSchema>;

// ---------- reports ----------

export const reportQuery = z.object({
  from: dateString.optional(),
  to: dateString.optional(),
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  departmentId: z.string().optional(),
  userId: z.string().optional(),
  format: z.enum(['json', 'xlsx', 'pdf']).default('json'),
});
export type ReportQuery = z.infer<typeof reportQuery>;
