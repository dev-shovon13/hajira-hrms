import { z } from 'zod';

export { holidaySchema } from '@hajira/shared';

export const holidayListQuery = z.object({
  year: z.coerce.number().int().min(2000).max(2100).default(() => new Date().getFullYear()),
});
