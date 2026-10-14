import { Router } from 'express';
import { departmentSchema, paginationQuery } from '@hajira/shared';
import { asyncHandler } from '@/utils/asyncHandler';
import { validate } from '@/middleware/validate';
import { authenticate, authorize } from '@/middleware/auth';
import * as c from './controller';

export const departmentRoutes = Router();

// Public: the registration form lists departments.
departmentRoutes.get('/options', asyncHandler(c.options));

departmentRoutes.use(authenticate);
departmentRoutes.get('/', authorize('HR', 'MANAGER'), validate({ query: paginationQuery }), asyncHandler(c.list));
departmentRoutes.post('/', authorize('HR'), validate({ body: departmentSchema }), asyncHandler(c.create));
departmentRoutes.put('/:id', authorize('HR'), validate({ body: departmentSchema }), asyncHandler(c.update));
departmentRoutes.delete('/:id', authorize('HR'), asyncHandler(c.remove));
