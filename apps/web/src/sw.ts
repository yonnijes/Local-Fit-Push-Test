/**
 * Service Worker de Local Fit Push Test.
 *
 * Responsabilidades:
 * - Recibir eventos push y mostrar la notificación.
 * - Enfocar/abrir la PWA cuando se pulsa una notificación.
 *
 * No administra temporizadores ni envíos: eso vive solo en el backend.
 */

interface ExtendableEventLike {
  waitUntil(promise: Promise<unknown>): void;
}

interface FetchEventLike extends ExtendableEventLike {
  request: Request;
  respondWith(response: Promise<Response>): void;
}

interface PrecacheEntry {
  url: string;
  revision?: string | null;
}

// Workbox inyecta aquí la lista de assets del build.
declare global {
  interface Window {
    __WB_MANIFEST: PrecacheEntry[];
  }
}

interface PushMessageDataLike {
  text(): string;
}

interface PushEventLike extends ExtendableEventLike {
  data: PushMessageDataLike | null;
}

interface NotificationClickEventLike extends ExtendableEventLike {
  notification: {
    close(): void;
    data: unknown;
  };
}

interface NotificationOptionsLike {
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  timestamp?: number;
  data?: unknown;
  lang?: string;
  renotify?: boolean;
  requireInteraction?: boolean;
}

interface WindowClientLike {
  url: string;
  focus(): Promise<unknown>;
}

interface ClientsLike {
  matchAll(options?: {
    type?: 'window';
    includeUncontrolled?: boolean;
  }): Promise<WindowClientLike[]>;
  openWindow(url: string): Promise<unknown>;
  claim(): Promise<void>;
}

interface ServiceWorkerScope {
  addEventListener(type: 'install' | 'activate', listener: (event: ExtendableEventLike) => void): void;
  addEventListener(type: 'fetch', listener: (event: FetchEventLike) => void): void;
  addEventListener(type: 'push', listener: (event: PushEventLike) => void): void;
  addEventListener(
    type: 'notificationclick',
    listener: (event: NotificationClickEventLike) => void,
  ): void;
  registration: {
    showNotification(title: string, options?: NotificationOptionsLike): Promise<void>;
  };
  clients: ClientsLike;
  skipWaiting(): Promise<void>;
  location: Location;
}

interface PushPayload {
  type?: unknown;
  sequence?: unknown;
  sentAt?: unknown;
  title?: unknown;
  body?: unknown;
  url?: unknown;
}

const sw = self as unknown as ServiceWorkerScope;

const DEFAULT_TITLE = 'Local Fit Push Test';
const DEFAULT_BODY = 'Notificación de prueba';
const FALLBACK_URL = '/';
const ICON_URL = '/icons/icon-192.png';
const CACHE_NAME = 'local-fit-push-test-shell-v1';

/*
 * Workbox reemplaza `self.__WB_MANIFEST` por la lista de assets del build.
 * Se usa para tener el shell disponible sin conexión; el foco de la prueba
 * sigue siendo el evento push.
 */
const PRECACHE_MANIFEST = self.__WB_MANIFEST;

sw.addEventListener('install', (event) => {
  event.waitUntil(precacheAndActivate());
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(sw.clients.claim());
});

sw.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== sw.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(handleFetch(request));
});

sw.addEventListener('push', (event) => {
  event.waitUntil(showPush(event));
});

sw.addEventListener('notificationclick', (event) => {
  event.waitUntil(handleClick(event));
});

async function precacheAndActivate(): Promise<void> {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PRECACHE_MANIFEST.map((entry) => entry.url));
  } catch (error) {
    // Un asset que falle no debe impedir que el Service Worker se active.
    console.warn('No se pudo precachear el shell completo:', error);
  }

  await sw.skipWaiting();
}

async function handleFetch(request: Request): Promise<Response> {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    return await fetch(request);
  } catch (error) {
    if (request.mode === 'navigate') {
      const fallback = await caches.match('/index.html');
      if (fallback) return fallback;
    }
    throw error;
  }
}

async function showPush(event: PushEventLike): Promise<void> {
  const payload = readPayload(event);
  const sequence =
    typeof payload.sequence === 'number' && Number.isFinite(payload.sequence)
      ? payload.sequence
      : null;

  const title = asText(payload.title) ?? DEFAULT_TITLE;
  const body =
    asText(payload.body) ??
    (sequence !== null ? `Notificación de prueba #${sequence}` : DEFAULT_BODY);

  const sentAtMs = typeof payload.sentAt === 'string' ? Date.parse(payload.sentAt) : Number.NaN;
  const timestamp = Number.isFinite(sentAtMs) ? sentAtMs : Date.now();
  const url = asText(payload.url) ?? FALLBACK_URL;

  await sw.registration.showNotification(title, {
    body,
    icon: ICON_URL,
    badge: ICON_URL,
    // Tag único para que cada notificación de prueba aparezca por separado.
    tag: sequence !== null ? `push-test-${sequence}` : `push-test-${timestamp}`,
    timestamp,
    lang: 'es',
    data: {
      type: 'push-test',
      url,
      sequence,
      sentAt: new Date(timestamp).toISOString(),
    },
  });
}

async function handleClick(event: NotificationClickEventLike): Promise<void> {
  const data = event.notification.data;
  const url =
    data !== null && typeof data === 'object' && typeof (data as { url?: unknown }).url === 'string'
      ? ((data as { url: string }).url ?? FALLBACK_URL)
      : FALLBACK_URL;

  event.notification.close();

  const targetUrl = new URL(url, sw.location.origin).href;

  try {
    const windowClients = await sw.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });

    const matching = windowClients.find((client) => client.url === targetUrl);
    if (matching) {
      await matching.focus();
      return;
    }

    if (windowClients.length > 0) {
      await windowClients[0].focus();
      return;
    }

    await sw.clients.openWindow(targetUrl);
  } catch {
    await sw.clients.openWindow(targetUrl);
  }
}

function readPayload(event: PushEventLike): PushPayload {
  const data = event.data;
  if (!data) return {};

  let text = '';
  try {
    text = data.text();
  } catch {
    return {};
  }

  if (text.trim().length === 0) return {};

  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed !== null && typeof parsed === 'object') {
      return parsed as PushPayload;
    }
  } catch {
    return { body: text };
  }

  return {};
}

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}
