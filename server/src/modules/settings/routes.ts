import { Router, type Request, type Response } from 'express';
import { settingsSchema } from '@hajira/shared';
import { asyncHandler } from '@/utils/asyncHandler';
import { validate, vb } from '@/middleware/validate';
import { authenticate, authorize, me } from '@/middleware/auth';
import { ok } from '@/utils/response';
import { getSettings, saveSettings } from '@/lib/settings';
import { audit } from '@/lib/audit';
import { AppError } from '@/utils/AppError';

export const settingsRoutes = Router();
settingsRoutes.use(authenticate);

settingsRoutes.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    ok(res, await getSettings());
  }),
);

settingsRoutes.put(
  '/',
  authorize('ADMIN', 'HR'),
  validate({ body: settingsSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const input = vb(req, settingsSchema);
    try {
      new Intl.DateTimeFormat('en', { timeZone: input.timezone });
    } catch {
      throw AppError.unprocessable('Unknown timezone', 'BAD_TIMEZONE', { timezone: ['Use an IANA name such as Asia/Dhaka'] });
    }
    const before = await getSettings();
    const after = await saveSettings(input);
    await audit({ actorId: me(req).id, action: 'settings.update', entity: 'Setting', before, after, ip: req.ip });
    ok(res, after, 'Settings saved');
  }),
);
