import { z } from 'zod';

export { attendanceEditSchema, attendanceListQuery } from '@hajira/shared';

export const monthQuery = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Use YYYY-MM')
    .optional(),
  userId: z.string().optional(),
});
