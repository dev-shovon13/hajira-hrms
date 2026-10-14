import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import type { ApiErrorBody, ApiResponse, PageMeta } from '@hajira/shared';

/**
 * One axios instance for the whole app. Requests go to this origin; Next
 * rewrites /api/v1 to the Express API, so httpOnly cookies just work.
 *
 * On a 401 the interceptor refreshes once (shared by concurrent requests) and
 * replays the request. If the refresh fails the session is over.
 */
export const api = axios.create({ baseURL: '/api/v1', withCredentials: true, timeout: 20_000 });

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const NO_REFRESH = /\/auth\/(login|refresh|logout|register|forgot-password|reset-password|verify-email|resend-verification|accept-invite)/;
let refreshing: Promise<void> | null = null;

function refreshSession() {
  refreshing ??= axios
    .post('/api/v1/auth/refresh', null, { withCredentials: true })
    .then(() => undefined)
    .finally(() => {
      // Let requests already waiting reuse this refresh, then allow a new one.
      setTimeout(() => (refreshing = null), 0);
    });
  return refreshing;
}

function sessionExpired() {
  if (typeof window === 'undefined') return;
  const here = window.location.pathname + window.location.search;
  if (window.location.pathname.startsWith('/login')) return;
  window.location.assign(`/login?expired=1&next=${encodeURIComponent(here)}`);
}

function toApiError(error: AxiosError<ApiErrorBody>) {
  if (error.response) {
    const body = error.response.data;
    return new ApiError(
      body?.message ?? 'Something went wrong. Please try again.',
      error.response.status,
      body?.code,
      body?.errors,
    );
  }
  if (error.code === 'ECONNABORTED') return new ApiError('The server took too long to answer. Try again.', 0, 'TIMEOUT');
  return new ApiError('Cannot reach the server. Check your connection.', 0, 'NETWORK');
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<ApiErrorBody>) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    if (error.response?.status === 401 && original && !original._retried && !NO_REFRESH.test(original.url ?? '')) {
      original._retried = true;
      try {
        await refreshSession();
        return api(original);
      } catch {
        sessionExpired();
      }
    }
    return Promise.reject(toApiError(error));
  },
);

// ---------- typed helpers ----------

export async function get<T>(url: string, config?: AxiosRequestConfig) {
  const res = await api.get<ApiResponse<T>>(url, config);
  return res.data.data;
}

export async function getPage<T>(url: string, params?: Record<string, unknown>) {
  const res = await api.get<ApiResponse<T[]>>(url, { params: clean(params) });
  return { rows: res.data.data, meta: res.data.meta as PageMeta };
}

/** Mutations return the server's message too, so toasts say what actually happened. */
export async function send<T>(method: 'post' | 'put' | 'patch' | 'delete', url: string, body?: unknown) {
  const res = await api.request<ApiResponse<T>>({ method, url, data: body });
  return { data: res.data.data, message: res.data.message };
}

/** Drops empty filter values so URLs stay clean and the API sees no blanks. */
export function clean(params?: Record<string, unknown>) {
  if (!params) return undefined;
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== 'all'));
}

/** Downloads an export (xlsx/pdf) through the authenticated client. */
export async function download(url: string, params: Record<string, unknown>, fallbackName: string) {
  const res = await api.get(url, { params: clean(params), responseType: 'blob' });
  const disposition = String(res.headers['content-disposition'] ?? '');
  const name = /filename="?([^"]+)"?/.exec(disposition)?.[1] ?? fallbackName;
  const href = URL.createObjectURL(res.data as Blob);
  const a = Object.assign(document.createElement('a'), { href, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
  return name;
}

export const errorMessage = (err: unknown) =>
  err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Something went wrong';
