import type { PushConfig, PushStatus, StoredSubscription } from '../types';

const API_BASE = '/api/push';
const TOKEN_STORAGE_KEY = 'local-fit-push-test.admin-token';
const REQUEST_TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function getAdminToken(): string {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setAdminToken(token: string): void {
  try {
    if (token.trim().length === 0) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    } else {
      localStorage.setItem(TOKEN_STORAGE_KEY, token.trim());
    }
  } catch {
    // localStorage puede no estar disponible (modo privado antiguo).
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = getAdminToken();
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers['x-push-admin-token'] = token;

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
      cache: 'no-store',
    });

    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      throw new ApiError(
        extractMessage(payload) ?? `El backend respondió HTTP ${response.status}.`,
        response.status,
      );
    }

    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('El backend no respondió a tiempo.', 0);
    }
    throw new ApiError(
      error instanceof Error ? error.message : 'No se pudo contactar con el backend.',
      0,
    );
  } finally {
    window.clearTimeout(timeout);
  }
}

function extractMessage(payload: unknown): string | null {
  if (payload === null || typeof payload !== 'object') return null;

  const message = (payload as { message?: unknown }).message;
  if (Array.isArray(message)) {
    const joined = message.filter((item): item is string => typeof item === 'string').join(' ');
    return joined.length > 0 ? joined : null;
  }
  if (typeof message === 'string' && message.trim().length > 0) {
    return message;
  }
  return null;
}

export const api = {
  getConfig(): Promise<PushConfig> {
    return request<PushConfig>('/config');
  },

  getStatus(): Promise<PushStatus> {
    return request<PushStatus>('/status');
  },

  subscribe(subscription: StoredSubscription): Promise<{ registered: boolean }> {
    return request<{ registered: boolean }>('/subscribe', {
      method: 'POST',
      body: subscription,
    });
  },

  sendTest(): Promise<{ accepted: boolean; message: string }> {
    return request<{ accepted: boolean; message: string }>('/send-test', {
      method: 'POST',
      body: {},
    });
  },

  start(intervalSeconds: number): Promise<{ running: boolean; intervalSeconds: number }> {
    return request<{ running: boolean; intervalSeconds: number }>('/start', {
      method: 'POST',
      body: { intervalSeconds },
    });
  },

  stop(): Promise<{ running: boolean }> {
    return request<{ running: boolean }>('/stop', {
      method: 'POST',
      body: {},
    });
  },
};
