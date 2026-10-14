import { z } from 'zod';

export {
  applyLeaveSchema,
  balanceAdjustSchema,
  calendarQuery,
  leaveListQuery,
  leavePreviewSchema,
  rejectSchema,
  reviewSchema,
} from '@hajira/shared';

export const balanceQuery = z.object({
  year: z.coerce.number().int().min(2000).max(2100).default(() => new Date().getFullYear()),
  userId: z.string().optional(),
});
