import type { UserStatus } from '@hajira/shared';
import type { Tone } from '@/lib/status';

export const STATUS_TONE: Record<UserStatus, Tone> = {
  ACTIVE: 'present',
  PENDING: 'late',
  INVITED: 'leave',
  SUSPENDED: 'absent',
  REJECTED: 'neutral',
};

export const STATUS_LABEL: Record<UserStatus, string> = {
  ACTIVE: 'Active',
  PENDING: 'Awaiting approval',
  INVITED: 'Invited',
  SUSPENDED: 'Suspended',
  REJECTED: 'Rejected',
};
