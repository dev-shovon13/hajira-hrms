import { Router, type Request, type Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { authenticate, authorize, me } from '@/middleware/auth';
import { ok } from '@/utils/response';
import * as service from './service';

export const dashboardRoutes = Router();
dashboardRoutes.use(authenticate);

dashboardRoutes.get(
  '/employee',
  asyncHandler(async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    ok(res, await service.employee(me(req), req.ip));
  }),
);

dashboardRoutes.get(
  '/manager',
  authorize('MANAGER', 'HR'),
  asyncHandler(async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    ok(res, await service.manager(me(req)));
  }),
);

dashboardRoutes.get(
  '/admin',
  authorize('HR'),
  asyncHandler(async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    ok(res, await service.admin(me(req)));
  }),
);
