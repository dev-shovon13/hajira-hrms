import type { Response } from 'express';
import type { PageMeta } from '@hajira/shared';

export function ok<T>(res: Response, data: T, message = 'OK', status = 200) {
  return res.status(status).json({ success: true, data, message });
}

export function created<T>(res: Response, data: T, message = 'Created') {
  return ok(res, data, message, 201);
}

export function paginated<T>(
  res: Response,
  data: T[],
  meta: { page: number; limit: number; total: number },
  message = 'OK',
) {
  const fullMeta: PageMeta = { ...meta, totalPages: Math.max(1, Math.ceil(meta.total / meta.limit)) };
  return res.status(200).json({ success: true, data, message, meta: fullMeta });
}

export function pageArgs(q: { page: number; limit: number }) {
  return { skip: (q.page - 1) * q.limit, take: q.limit };
}
