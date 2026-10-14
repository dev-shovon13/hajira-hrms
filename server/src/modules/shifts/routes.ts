import { Router } from 'express';
import { assignShiftSchema, shiftSchema } from '@hajira/shared';
import { asyncHandler } from '@/utils/asyncHandler';
import { validate } from '@/middleware/validate';
import { authenticate, authorize } from '@/middleware/auth';
import * as c from './controller';

export const shiftRoutes = Router();

shiftRoutes.use(authenticate);
shiftRoutes.get('/', asyncHandler(c.list));
shiftRoutes.post('/', authorize('HR'), validate({ body: shiftSchema }), asyncHandler(c.create));
shiftRoutes.put('/:id', authorize('HR'), validate({ body: shiftSchema }), asyncHandler(c.update));
shiftRoutes.delete('/:id', authorize('HR'), asyncHandler(c.remove));
shiftRoutes.post('/:id/assign', authorize('HR'), validate({ body: assignShiftSchema }), asyncHandler(c.assign));
