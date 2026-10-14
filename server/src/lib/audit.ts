import type { Prisma } from '@prisma/client';
import { prisma, type Tx } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export interface AuditEntry {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
}

const json = (v: unknown) =>
  v === undefined ? undefined : (JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue);

/** Writes an audit entry. Pass a transaction client to make it atomic with the change. */
export async function audit(entry: AuditEntry, db: Tx = prisma) {
  try {
    await db.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        before: json(entry.before),
        after: json(entry.after),
        ip: entry.ip ?? null,
      },
    });
  } catch (err) {
    // Inside a transaction the caller must see the failure; outside, never block the action.
    if (db !== prisma) throw err;
    logger.error({ err, entry }, 'Failed to write audit log');
  }
}
