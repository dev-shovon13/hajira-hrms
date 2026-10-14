import rateLimit from 'express-rate-limit';

const message = (what: string) => ({
  success: false,
  data: null,
  code: 'RATE_LIMITED',
  message: `Too many ${what}. Please wait a few minutes and try again.`,
});

const base = { standardHeaders: 'draft-7' as const, legacyHeaders: false };

export const apiLimiter = rateLimit({ ...base, windowMs: 60_000, limit: 300, message: message('requests') });

export const loginLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60_000,
  limit: 10,
  // Key on IP + email so one attacker cannot lock out everyone behind the same NAT.
  keyGenerator: (req) => `${req.ip}:${String(req.body?.email ?? '').toLowerCase()}`,
  skipSuccessfulRequests: true,
  message: message('sign-in attempts'),
});

export const registerLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60_000,
  limit: 10,
  message: message('registrations from this network'),
});

export const forgotPasswordLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60_000,
  limit: 5,
  message: message('password reset requests'),
});

export const sensitiveLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60_000,
  limit: 20,
  message: message('attempts'),
});
