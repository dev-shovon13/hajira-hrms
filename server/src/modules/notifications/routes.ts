import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '@/utils/asyncHandler';
import { validate, vq } from '@/middleware/validate';
import { authenticate, me } from '@/middleware/auth';
import { ok } from '@/utils/response';
import * as service from './service';

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  unread: z.enum(['true', 'false']).optional(),
});

export const notificationRoutes = Router();
notificationRoutes.use(authenticate);

notificationRoutes.get(
  '/',
  validate({ query: listQuery }),
  asyncHandler(async (req: Request, res: Response) => {
    const q = vq(req, listQuery);
    const { rows, total, unread } = await service.list(me(req).id, q.page, q.limit, q.unread === 'true');
    res.json({
      success: true,
      data: { items: rows, unread },
      message: 'OK',
      meta: { page: q.page, limit: q.limit, total, totalPages: Math.max(1, Math.ceil(total / q.limit)) },
    });
  }),
);

notificationRoutes.get(
  '/unread-count',
  asyncHandler(async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    ok(res, { count: await service.unreadCount(me(req).id) });
  }),
);

notificationRoutes.post(
  '/read-all',
  asyncHandler(async (req: Request, res: Response) => {
    const count = await service.markAllRead(me(req).id);
    ok(res, { count }, count ? `Marked ${count} as read` : 'Nothing unread');
  }),
);

notificationRoutes.post(
  '/:id/read',
  asyncHandler(async (req: Request, res: Response) => {
    await service.markRead(me(req).id, req.params.id);
    ok(res, null, 'Marked as read');
  }),
);
