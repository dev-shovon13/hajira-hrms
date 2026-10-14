import { Router } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { validate } from '@/middleware/validate';
import { authenticate, authorize } from '@/middleware/auth';
import { attendanceEditSchema, attendanceListQuery, monthQuery } from './schema';
import * as c from './controller';

export const attendanceRoutes = Router();

attendanceRoutes.use(authenticate);
attendanceRoutes.get('/today', asyncHandler(c.today));
attendanceRoutes.post('/check-in', asyncHandler(c.checkIn));
attendanceRoutes.post('/check-out', asyncHandler(c.checkOut));
attendanceRoutes.get('/month', validate({ query: monthQuery }), asyncHandler(c.month));
attendanceRoutes.get('/', authorize('MANAGER', 'HR'), validate({ query: attendanceListQuery }), asyncHandler(c.list));
attendanceRoutes.patch('/:id', authorize('HR'), validate({ body: attendanceEditSchema }), asyncHandler(c.edit));
