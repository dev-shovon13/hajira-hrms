import type { AttendanceStatus, LeaveStatus, RequestStatus } from '@hajira/shared';

export type Tone = 'present' | 'late' | 'absent' | 'leave' | 'holiday' | 'halfday' | 'neutral';

/**
 * Thread palette. `mark` is the stitch / chart colour (CSS var), `ink` and
 * `wash` are the accessible text and background classes for badges.
 */
export const TONES: Record<Tone, { mark: string; ink: string; wash: string }> = {
  present: { mark: 'var(--present)', ink: 'text-present-ink', wash: 'bg-present-wash' },
  late: { mark: 'var(--late)', ink: 'text-late-ink', wash: 'bg-late-wash' },
  absent: { mark: 'var(--absent)', ink: 'text-absent-ink', wash: 'bg-absent-wash' },
  leave: { mark: 'var(--leave)', ink: 'text-leave-ink', wash: 'bg-leave-wash' },
  holiday: { mark: 'var(--holiday)', ink: 'text-holiday-ink', wash: 'bg-holiday-wash' },
  halfday: { mark: 'var(--halfday)', ink: 'text-halfday-ink', wash: 'bg-halfday-wash' },
  neutral: { mark: 'var(--off)', ink: 'text-muted-foreground', wash: 'bg-muted' },
};

export const ATTENDANCE_TONE: Record<AttendanceStatus, Tone> = {
  PRESENT: 'present',
  LATE: 'late',
  ABSENT: 'absent',
  HALF_DAY: 'halfday',
  ON_LEAVE: 'leave',
  HOLIDAY: 'holiday',
  WEEKEND: 'neutral',
};

export const REQUEST_TONE: Record<LeaveStatus | RequestStatus, Tone> = {
  // Pending is a dashed thread, not lateness: it takes the leave hue, never amber.
  PENDING: 'leave',
  APPROVED: 'present',
  REJECTED: 'absent',
  CANCELLED: 'neutral',
};

export const REQUEST_LABEL: Record<LeaveStatus | RequestStatus, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};
