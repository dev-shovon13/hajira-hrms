import { z } from 'zod';
import { paginationQuery } from '@hajira/shared';

export { designationSchema } from '@hajira/shared';

export const designationListQuery = paginationQuery.extend({ departmentId: z.string().optional() });
