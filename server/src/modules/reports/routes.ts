import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { reportQuery } from '@hajira/shared';
import { asyncHandler } from '@/utils/asyncHandler';
import { validate, vq } from '@/middleware/validate';
import { authenticate, authorize, me } from '@/middleware/auth';
import { ok } from '@/utils/response';
import { getSettings } from '@/lib/settings';
import * as service from './service';
import * as exporters from './exporters';

const pagedReportQuery = reportQuery.extend({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
});

export const reportRoutes = Router();
reportRoutes.use(authenticate, authorize('MANAGER', 'HR'));

reportRoutes.get(
  '/monthly',
  validate({ query: reportQuery }),
  asyncHandler(async (req: Request, res: Response) => {
    const q = vq(req, reportQuery);
    const sheet = await service.monthlySheet(me(req), q);
    if (q.format === 'xlsx') return exporters.monthlySheetXlsx(res, sheet);
    if (q.format === 'pdf') return exporters.monthlySheetPdf(res, sheet);
    ok(res, sheet);
  }),
);

reportRoutes.get(
  '/late',
  validate({ query: pagedReportQuery }),
  asyncHandler(async (req: Request, res: Response) => {
    const q = vq(req, pagedReportQuery);
    const { timezone } = await getSettings();
    if (q.format !== 'json') {
      const data = await service.lateReport(me(req), q);
      return q.format === 'xlsx' ? exporters.lateXlsx(res, data, timezone) : exporters.latePdf(res, data, timezone);
    }
    const data = await service.lateReport(me(req), q, { skip: (q.page - 1) * q.limit, take: q.limit });
    res.json({
      success: true,
      data: { rows: data.rows, summary: data.summary, from: data.from, to: data.to },
      message: 'OK',
      meta: { page: q.page, limit: q.limit, total: data.total, totalPages: Math.max(1, Math.ceil(data.total / q.limit)) },
    });
  }),
);

reportRoutes.get(
  '/leave',
  validate({ query: pagedReportQuery }),
  asyncHandler(async (req: Request, res: Response) => {
    const q = vq(req, pagedReportQuery);
    if (q.format !== 'json') {
      const data = await service.leaveReport(me(req), q);
      return q.format === 'xlsx' ? exporters.leaveXlsx(res, data) : exporters.leavePdf(res, data);
    }
    const data = await service.leaveReport(me(req), q, { skip: (q.page - 1) * q.limit, take: q.limit });
    res.json({
      success: true,
      data: { rows: data.rows, summary: data.summary, from: data.from, to: data.to },
      message: 'OK',
      meta: { page: q.page, limit: q.limit, total: data.total, totalPages: Math.max(1, Math.ceil(data.total / q.limit)) },
    });
  }),
);

