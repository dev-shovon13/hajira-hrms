import { Router } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { validate } from '@/middleware/validate';
import { authenticate, authorize } from '@/middleware/auth';
import { designationListQuery, designationSchema } from './schema';
import * as c from './controller';

export const designationRoutes = Router();

// Public: the registration form lists designations.
designationRoutes.get('/options', asyncHandler(c.options));

designationRoutes.use(authenticate);
designationRoutes.get('/', authorize('HR'), validate({ query: designationListQuery }), asyncHandler(c.list));
designationRoutes.post('/', authorize('HR'), validate({ body: designationSchema }), asyncHandler(c.create));
designationRoutes.put('/:id', authorize('HR'), validate({ body: designationSchema }), asyncHandler(c.update));
designationRoutes.delete('/:id', authorize('HR'), asyncHandler(c.remove));
