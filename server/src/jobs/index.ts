import cron, { type ScheduledTask } from 'node-cron';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';
import { autoCloseOpenDays, closeDay, applyLatePolicy, rollLeaveYear } from './tasks';

const tasks: ScheduledTask[] = [];

/** Runs a job and logs failures instead of crashing the process. */
function guard(name: string, fn: () => Promise<unknown>) {
  return async () => {
    const started = Date.now();
    try {
      const result = await fn();
      logger.info({ job: name, ms: Date.now() - started, result }, `job ${name} done`);
    } catch (err) {
      logger.error({ err, job: name }, `job ${name} failed`);
    }
  };
}

/** The scheduled jobs by name; serverless hosts trigger them over HTTP (GET /api/cron/:job) instead of node-cron. */
export const jobs: Record<string, () => Promise<unknown>> = {
  'auto-close': () => autoCloseOpenDays(),
  'close-day': () => closeDay(),
  'late-policy': () => applyLatePolicy(),
  'leave-year': () => rollLeaveYear(),
};

export function startJobs() {
  const timezone = env.OFFICE_TIMEZONE;
  // Close forgotten check-outs once their shift is well over (night shifts included).
  tasks.push(cron.schedule('*/15 * * * *', guard('auto-close', jobs['auto-close']), { timezone }));
  // Shortly after midnight, settle yesterday: ABSENT / ON_LEAVE / HOLIDAY / WEEKEND for everyone without a record.
  tasks.push(cron.schedule('10 0 * * *', guard('close-day', jobs['close-day']), { timezone }));
  // On the 1st, apply "X late marks = 1 leave day" for the previous month.
  tasks.push(cron.schedule('30 1 1 * *', guard('late-policy', jobs['late-policy']), { timezone }));
  // On 1 January, open the new leave year (carry-forward applied).
  tasks.push(cron.schedule('0 2 1 1 *', guard('leave-year', jobs['leave-year']), { timezone }));
  logger.info(`Scheduled ${tasks.length} jobs (${timezone})`);
}

export function stopJobs() {
  for (const t of tasks) t.stop();
  tasks.length = 0;
}
