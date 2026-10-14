import type { SettingsDto } from '@hajira/shared';
import { prisma } from '@/lib/prisma';
import { env } from '@/config/env';

export const DEFAULT_SETTINGS: SettingsDto = {
  timezone: env.OFFICE_TIMEZONE,
  ipRestriction: { enabled: false, allowedIps: [] },
  latePolicy: { enabled: true, lateMarksPerDeduction: 3, deductLeaveTypeCode: 'CL' },
  approvalFlow: { levels: ['MANAGER', 'HR'] },
  autoCloseAfterMinutes: 120,
};

type Key = keyof SettingsDto;
const KEYS = Object.keys(DEFAULT_SETTINGS) as Key[];

let cache: { value: SettingsDto; at: number } | null = null;
const TTL = 30_000;

export async function getSettings(): Promise<SettingsDto> {
  if (cache && Date.now() - cache.at < TTL) return cache.value;
  const rows = await prisma.setting.findMany({ where: { key: { in: KEYS } } });
  const value = { ...DEFAULT_SETTINGS } as SettingsDto;
  for (const row of rows) (value as unknown as Record<string, unknown>)[row.key] = row.value;
  cache = { value, at: Date.now() };
  return value;
}

export async function saveSettings(next: SettingsDto) {
  await prisma.$transaction(
    KEYS.map((key) =>
      prisma.setting.upsert({
        where: { key },
        create: { key, value: next[key] as object },
        update: { value: next[key] as object },
      }),
    ),
  );
  cache = null;
  return getSettings();
}

export async function officeTz() {
  return (await getSettings()).timezone;
}
