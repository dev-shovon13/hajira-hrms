import { Router } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { validate } from '@/middleware/validate';
import { authenticate, authorize } from '@/middleware/auth';
import {
  applyLeaveSchema,
  balanceAdjustSchema,
  balanceQuery,
  calendarQuery,
  leaveListQuery,
  leavePreviewSchema,
  rejectSchema,
  reviewSchema,
} from './schema';
import * as c from './controller';

export const leaveRoutes = Router();

leaveRoutes.use(authenticate);

leaveRoutes.get('/balances', validate({ query: balanceQuery }), asyncHandler(c.balances));
leaveRoutes.post('/balances/adjust', authorize('HR'), validate({ body: balanceAdjustSchema }), asyncHandler(c.adjust));

leaveRoutes.get('/calendar', validate({ query: calendarQuery }), asyncHandler(c.calendar));
leaveRoutes.post('/attachments', c.attachmentUpload, asyncHandler(c.uploadAttachment));

leaveRoutes.post('/requests/preview', validate({ body: leavePreviewSchema }), asyncHandler(c.preview));
leaveRoutes.get('/requests', validate({ query: leaveListQuery }), asyncHandler(c.list));
leaveRoutes.post('/requests', validate({ body: applyLeaveSchema }), asyncHandler(c.apply));
leaveRoutes.get('/requests/:id', asyncHandler(c.getOne));
leaveRoutes.post('/requests/:id/approve', authorize('MANAGER', 'HR'), validate({ body: reviewSchema }), asyncHandler(c.approve));
leaveRoutes.post('/requests/:id/reject', authorize('MANAGER', 'HR'), validate({ body: rejectSchema }), asyncHandler(c.reject));
leaveRoutes.post('/requests/:id/cancel', asyncHandler(c.cancel));
