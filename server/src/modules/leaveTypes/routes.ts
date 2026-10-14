import { Router } from 'express';
import { leaveTypeSchema } from '@hajira/shared';
import { asyncHandler } from '@/utils/asyncHandler';
import { validate } from '@/middleware/validate';
import { authenticate, authorize } from '@/middleware/auth';
import * as c from './controller';

export const leaveTypeRoutes = Router();

leaveTypeRoutes.use(authenticate);
leaveTypeRoutes.get('/', asyncHandler(c.list));
leaveTypeRoutes.post('/', authorize('HR'), validate({ body: leaveTypeSchema }), asyncHandler(c.create));
leaveTypeRoutes.put('/:id', authorize('HR'), validate({ body: leaveTypeSchema }), asyncHandler(c.update));
leaveTypeRoutes.delete('/:id', authorize('HR'), asyncHandler(c.archive));
