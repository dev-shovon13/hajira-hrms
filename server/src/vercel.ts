import { createApp } from '@/app';

// Vercel entry: the platform invokes the app per request, so there is no listen() and no node-cron.
// Scheduled jobs come in through Vercel Cron instead (vercel.json → GET /api/cron/:job).
export const app = createApp();
