import type { AuthResponse } from '@satzio/shared';

/**
 * HTTP-Client für die SATZIO-API.
 * - Access-Token nur im Speicher (nie im localStorage)
 * - Refresh über HTTP-only-Cookie + CSRF-Header (Web) bzw. Token im Body (native App)
 * - Automatischer, einmaliger Refresh bei 401
 */
export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
const NATIVE_KEY = 'satzio-native-rt';

export function isNativeApp(): boolean {
  const cap = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return !!cap?.isNativePlatform?.();
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
  get isNetwork() {
    return this.status === 0;
  }
}

let accessToken: string | null = null;
let refreshPromise: Promise<AuthResponse> | null = null;
let onSession: ((r: AuthResponse | null, reason?: string) => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function hasAccessToken() {
  return accessToken !== null;
}

/** Callback, wenn eine Sitzung erneuert wurde (r) oder endgültig abgelaufen ist (null). */
export function onSessionChange(cb: typeof onSession) {
  onSession = cb;
}

function csrfFromCookie(): string | undefined {
  const m = /(?:^|;\s*)satzio_csrf=([^;]+)/.exec(document.cookie);
  return m ? decodeURIComponent(m[1]) : undefined;
}

function baseHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  if (isNativeApp()) h['X-Satzio-Client'] = 'native';
  return h;
}

async function parseError(res: Response): Promise<ApiError> {
  let body: { code?: string; message?: string; details?: unknown } = {};
  try {
    body = await res.json();
  } catch {
    /* kein JSON */
  }
  return new ApiError(res.status, body.code ?? 'ERROR', body.message ?? `Fehler ${res.status}`, body.details);
}

async function rawFetch(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(`${API_BASE}/api/v1${path}`, { credentials: 'include', ...init });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Keine Verbindung zum Server.');
  }
}

/** Erneuert die Sitzung (single-flight). */
export function refreshSession(): Promise<AuthResponse> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const native = isNativeApp();
      const headers: Record<string, string> = { ...baseHeaders(), 'Content-Type': 'application/json' };
      const csrf = csrfFromCookie();
      if (csrf) headers['X-CSRF-Token'] = csrf;
      const body = native ? JSON.stringify({ refreshToken: localStorage.getItem(NATIVE_KEY) ?? '' }) : '{}';
      const res = await rawFetch('/auth/refresh', { method: 'POST', headers, body });
      if (!res.ok) {
        const err = await parseError(res);
        if (err.status === 401 || err.status === 403) {
          accessToken = null;
          if (native) localStorage.removeItem(NATIVE_KEY);
          onSession?.(null, err.code);
        }
        throw err;
      }
      const data = (await res.json()) as AuthResponse;
      applyAuth(data);
      onSession?.(data);
      return data;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export function applyAuth(data: AuthResponse) {
  accessToken = data.accessToken;
  if (data.refreshToken && isNativeApp()) localStorage.setItem(NATIVE_KEY, data.refreshToken);
}

export function clearNativeToken() {
  try {
    localStorage.removeItem(NATIVE_KEY);
  } catch {
    /* ignore */
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  /** Keine automatische Token-Erneuerung (z. B. Login). */
  noRefresh?: boolean;
  /** Antwort als Text statt JSON. */
  text?: boolean;
  /** FormData für Uploads. */
  form?: FormData;
}

export async function api<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const doFetch = () => {
    const headers: Record<string, string> = baseHeaders();
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    let body: BodyInit | undefined;
    if (opts.form) body = opts.form;
    else if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(opts.body);
    }
    if (path.startsWith('/auth/logout')) {
      const csrf = csrfFromCookie();
      if (csrf) headers['X-CSRF-Token'] = csrf;
    }
    return rawFetch(path, { method: opts.method ?? 'GET', headers, body, signal: opts.signal });
  };

  let res = await doFetch();
  if (res.status === 401 && !opts.noRefresh) {
    try {
      await refreshSession();
    } catch (e) {
      if (e instanceof ApiError && e.isNetwork) throw e;
      throw await parseError(res);
    }
    res = await doFetch();
  }
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  if (opts.text) return (await res.text()) as T;
  const ct = res.headers.get('content-type') ?? '';
  return (ct.includes('application/json') ? await res.json() : await res.text()) as T;
}

/** Datei-Download (Export) mit Authentifizierung. */
export async function downloadFile(path: string, filename: string) {
  const doFetch = () =>
    rawFetch(path, { headers: { ...baseHeaders(), ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) } });
  let res = await doFetch();
  if (res.status === 401) {
    await refreshSession();
    res = await doFetch();
  }
  if (!res.ok) throw await parseError(res);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function errorMessage(e: unknown, fallback = 'Etwas ist schiefgelaufen.'): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}
