/**
 * Run a scheduled job by hand:
 *   npm run jobs:run -w server -- close-day [YYYY-MM-DD]
 *   npm run jobs:run -w server -- auto-close
 *   npm run jobs:run -w server -- late-policy [YYYY-MM]
 *   npm run jobs:run -w server -- leave-year [YYYY]
 */
import { prisma } from '@/lib/prisma';
import { applyLatePolicy, autoCloseOpenDays, closeDay, rollLeaveYear } from './tasks';

const [job, arg] = process.argv.slice(2);

const jobs: Record<string, () => Promise<unknown>> = {
  'close-day': () => closeDay(arg),
  'auto-close': () => autoCloseOpenDays(),
  'late-policy': () => applyLatePolicy(arg),
  'leave-year': () => rollLeaveYear(arg ? Number(arg) : undefined),
};

async function main() {
  const fn = jobs[job];
  if (!fn) {
    console.error(`Unknown job "${job ?? ''}". Choose one of: ${Object.keys(jobs).join(', ')}`);
    process.exit(1);
  }
  console.log(JSON.stringify(await fn(), null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
