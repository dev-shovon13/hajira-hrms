import type { NotificationType, Role } from '@prisma/client';
import { prisma, type Tx } from '@/lib/prisma';
import { sendMail, type Mail } from '@/lib/mailer';

interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  email?: Mail;
}

/** In-app notification plus an optional email. Email is sent after the row is written. */
export async function notify(input: NotifyInput, db: Tx = prisma) {
  await db.notification.create({
    data: { userId: input.userId, type: input.type, title: input.title, body: input.body, link: input.link },
  });
  if (input.email) sendMail(input.email);
}

export async function notifyMany(inputs: NotifyInput[], db: Tx = prisma) {
  if (inputs.length === 0) return;
  await db.notification.createMany({
    data: inputs.map((i) => ({ userId: i.userId, type: i.type, title: i.title, body: i.body, link: i.link })),
  });
  for (const i of inputs) if (i.email) sendMail(i.email);
}

/** Active users holding any of the given roles (e.g. everyone who can approve accounts). */
export function usersWithRoles(roles: Role[], excludeId?: string) {
  return prisma.user.findMany({
    where: { role: { in: roles }, status: 'ACTIVE', deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true, name: true, email: true },
  });
}
