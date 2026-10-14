import { z } from 'zod';
import { ROLES } from '@hajira/shared';

export {
  approveAccountSchema,
  inviteUserSchema,
  rejectSchema,
  updateProfileSchema,
  updateUserSchema,
  userListQuery,
} from '@hajira/shared';

export const optionsQuery = z.object({
  roles: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',') : undefined))
    .pipe(z.array(z.enum(ROLES)).optional()),
});
