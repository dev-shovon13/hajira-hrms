import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { CookieOptions, Response } from 'express';
import type { Role } from '@prisma/client';
import { env } from '@/config/env';

export const ACCESS_COOKIE = 'hj_at';
export const REFRESH_COOKIE = 'hj_rt';
/** Non-secret session hint (role only) that lets the web app's middleware route without the API. */
export const SESSION_COOKIE = 'hj_session';

const REFRESH_PATH = '/api/v1/auth';
const SHORT_SESSION_DAYS = 1;

export interface AccessPayload {
  sub: string;
  role: Role;
}

export interface RefreshPayload {
  sub: string;
  fam: string;
  jti: string;
}

export const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');

export function signAccessToken(payload: AccessPayload) {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: `${env.ACCESS_TOKEN_TTL_MINUTES}m`,
    issuer: 'hajira',
    audience: 'hajira-web',
  });
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: 'hajira', audience: 'hajira-web' }) as AccessPayload &
    jwt.JwtPayload;
}

export function refreshTtlDays(remember: boolean) {
  return remember ? env.REFRESH_TOKEN_TTL_DAYS : SHORT_SESSION_DAYS;
}

export function signRefreshToken(payload: RefreshPayload, remember: boolean) {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: `${refreshTtlDays(remember)}d`,
    issuer: 'hajira',
  });
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, { issuer: 'hajira' }) as RefreshPayload & jwt.JwtPayload;
}

function baseCookie(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'lax',
    domain: env.COOKIE_DOMAIN || undefined,
  };
}

/**
 * Sets the auth cookies. Without "remember me" the refresh + session cookies are
 * browser-session cookies (no maxAge), so closing the browser signs the user out.
 */
export function setAuthCookies(
  res: Response,
  tokens: { access: string; refresh: string; role: Role; remember: boolean },
) {
  const refreshMaxAge = refreshTtlDays(tokens.remember) * 24 * 60 * 60 * 1000;
  res.cookie(ACCESS_COOKIE, tokens.access, {
    ...baseCookie(),
    path: '/',
    maxAge: env.ACCESS_TOKEN_TTL_MINUTES * 60 * 1000,
  });
  res.cookie(REFRESH_COOKIE, tokens.refresh, {
    ...baseCookie(),
    path: REFRESH_PATH,
    ...(tokens.remember ? { maxAge: refreshMaxAge } : {}),
  });
  res.cookie(SESSION_COOKIE, tokens.role, {
    ...baseCookie(),
    path: '/',
    ...(tokens.remember ? { maxAge: refreshMaxAge } : {}),
  });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, { ...baseCookie(), path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...baseCookie(), path: REFRESH_PATH });
  res.clearCookie(SESSION_COOKIE, { ...baseCookie(), path: '/' });
}
