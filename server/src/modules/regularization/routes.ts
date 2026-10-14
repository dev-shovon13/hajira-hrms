import { Router } from 'express';
import { regularizationSchema, rejectSchema, requestListQuery, reviewSchema } from '@hajira/shared';
import { asyncHandler } from '@/utils/asyncHandler';
import { validate } from '@/middleware/validate';
import { authenticate, authorize } from '@/middleware/auth';
import * as c from './controller';

export const regularizationRoutes = Router();

regularizationRoutes.use(authenticate);
regularizationRoutes.get('/', validate({ query: requestListQuery }), asyncHandler(c.list));
regularizationRoutes.post('/', validate({ body: regularizationSchema }), asyncHandler(c.create));
regularizationRoutes.post('/:id/approve', authorize('MANAGER', 'HR'), validate({ body: reviewSchema }), asyncHandler(c.approve));
regularizationRoutes.post('/:id/reject', authorize('MANAGER', 'HR'), validate({ body: rejectSchema }), asyncHandler(c.reject));
regularizationRoutes.post('/:id/cancel', asyncHandler(c.cancel));
