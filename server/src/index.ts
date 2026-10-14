import { env } from '@/config/env';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { createApp } from '@/app';
import { startJobs, stopJobs } from '@/jobs';

async function main() {
  await prisma.$connect();
  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`API ready on http://localhost:${env.PORT} · docs at http://localhost:${env.PORT}/api/docs`);
  });
  if (env.ENABLE_CRON) startJobs();

  const shutdown = (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    stopJobs();
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

process.on('unhandledRejection', (err) => logger.error({ err }, 'Unhandled rejection'));

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start');
  process.exit(1);
});
