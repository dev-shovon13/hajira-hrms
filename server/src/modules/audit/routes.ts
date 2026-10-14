import { Router, type Request, type Response } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import type { AuditLogDto } from '@hajira/shared';
import { paginationQuery, dateString } from '@hajira/shared';
import { asyncHandler } from '@/utils/asyncHandler';
import { validate, vq } from '@/middleware/validate';
import { authenticate, authorize } from '@/middleware/auth';
import { pageArgs, paginated } from '@/utils/response';
import { prisma } from '@/lib/prisma';
import { addDaysStr, dbDate } from '@/lib/time';

const query = paginationQuery.extend({
  entity: z.string().optional(),
  action: z.string().optional(),
  actorId: z.string().optional(),
  from: dateString.optional(),
  to: dateString.optional(),
});

export const auditRoutes = Router();
auditRoutes.use(authenticate, authorize('HR', 'ADMIN'));

auditRoutes.get(
  '/',
  validate({ query }),
  asyncHandler(async (req: Request, res: Response) => {
    const q = vq(req, query);
    const where: Prisma.AuditLogWhereInput = {
      ...(q.entity ? { entity: q.entity } : {}),
      ...(q.action ? { action: { startsWith: q.action } } : {}),
      ...(q.actorId ? { actorId: q.actorId } : {}),
      ...(q.from || q.to
        ? { createdAt: { ...(q.from ? { gte: dbDate(q.from) } : {}), ...(q.to ? { lt: dbDate(addDaysStr(q.to, 1)) } : {}) } }
        : {}),
      ...(q.search
        ? { OR: [{ action: { contains: q.search, mode: 'insensitive' } }, { actor: { name: { contains: q.search, mode: 'insensitive' } } }] }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, name: true } } },
        orderBy: { createdAt: q.order },
        ...pageArgs(q),
      }),
      prisma.auditLog.count({ where }),
    ]);
    const data: AuditLogDto[] = rows.map((r) => ({
      id: r.id,
      action: r.action,
      entity: r.entity,
      entityId: r.entityId,
      before: r.before,
      after: r.after,
      ip: r.ip,
      createdAt: r.createdAt.toISOString(),
      actor: r.actor,
    }));
    paginated(res, data, { page: q.page, limit: q.limit, total });
  }),
);
