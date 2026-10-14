import { Router } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { validate } from '@/middleware/validate';
import { authenticate, authorize } from '@/middleware/auth';
import { holidayListQuery, holidaySchema } from './schema';
import * as c from './controller';

export const holidayRoutes = Router();

holidayRoutes.use(authenticate);
holidayRoutes.get('/', validate({ query: holidayListQuery }), asyncHandler(c.list));
holidayRoutes.post('/', authorize('HR'), validate({ body: holidaySchema }), asyncHandler(c.create));
holidayRoutes.put('/:id', authorize('HR'), validate({ body: holidaySchema }), asyncHandler(c.update));
holidayRoutes.delete('/:id', authorize('HR'), asyncHandler(c.remove));
