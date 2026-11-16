import type { StoredSubscription } from '../types';

const SW_TIMEOUT_MS = 15_000;
const SUBSCRIBE_TIMEOUT_MS = 45_000;
const SW_SCOPE = '/';

export interface BrowserSupport {
  supported: boolean;
  reason: string | null;
}

export function getBrowserSupport(): BrowserSupport {
  if (!window.isSecureContext) {
    return {
      supported: false,
      reason: 'Se requiere HTTPS (o localhost) para usar Service Workers y Push.',
    };
  }
  if (!('serviceWorker' in navigator)) {
    return { supported: false, reason: 'Este navegador no soporta Service Workers.' };
  }
  if (!('PushManager' in window)) {
    return {
      supported: false,
      reason: 'Este navegador no soporta Push API. En iOS necesitas iOS 16.4 o superior.',
    };
  }
  if (!('Notification' in window)) {
    return { supported: false, reason: 'Este navegador no soporta la API de notificaciones.' };
  }
  return { supported: true, reason: null };
}

export function isIOS(): boolean {
  const { userAgent, platform, maxTouchPoints } = navigator;
  if (/iPad|iPhone|iPod/.test(userAgent)) return true;
  // iPadOS 13+ se presenta como macOS.
  return platform === 'MacIntel' && maxTouchPoints > 1;
}

export function isIosOutdated(): boolean {
  return isIOS() && !('PushManager' in window);
}

export function isStandalone(): boolean {
  const standaloneDisplay = window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standaloneDisplay || iosStandalone;
}

export function getPermissionState(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

/**
 * Debe invocarse de forma síncrona dentro de un gesto del usuario (click),
 * especialmente en iOS. No hagas awaits antes de llamar a esta función.
 */
export function requestNotificationPermission(): Promise<NotificationPermission> {
  return Notification.requestPermission();
}

export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Este navegador no soporta Service Workers.');
  }

  const existing = await waitForRegistration();

  if (existing?.active) return existing;

  if (!existing) {
    try {
      await navigator.serviceWorker.register('/sw.js', { scope: SW_SCOPE });
    } catch (error) {
      throw new Error(
        `No se pudo registrar el Service Worker: ${errorMessage(error)}. Recarga la aplicación en el build de producción.`,
      );
    }
  }

  return withTimeout(
    navigator.serviceWorker.ready,
    SW_TIMEOUT_MS,
    'El Service Worker no se activó a tiempo. Cierra y vuelve a abrir la aplicación.',
  );
}

async function waitForRegistration(): Promise<ServiceWorkerRegistration | undefined> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const registration = await navigator.serviceWorker.getRegistration(SW_SCOPE);
    if (registration) return registration;
    await delay(150);
  }

  return undefined;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  const registration = await getServiceWorkerRegistration();
  return registration.pushManager.getSubscription();
}

export async function subscribeToPush(vapidPublicKey: string): Promise<PushSubscription> {
  const registration = await getServiceWorkerRegistration();
  const existing = await registration.pushManager.getSubscription();

  if (existing) return existing;

  if (!vapidPublicKey) {
    throw new Error('El backend no expuso una clave pública VAPID.');
  }

  try {
    return await withTimeout(
      registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      }),
      SUBSCRIBE_TIMEOUT_MS,
      'El navegador no completó la suscripción push a tiempo. Comprueba la conexión y vuelve a intentarlo.',
    );
  } catch (error) {
    throw new Error(`No se pudo crear la suscripción push: ${errorMessage(error)}`);
  }
}

export async function renewPushSubscription(vapidPublicKey: string): Promise<PushSubscription> {
  const registration = await getServiceWorkerRegistration();
  const existing = await registration.pushManager.getSubscription();

  if (existing) {
    await existing.unsubscribe();
  }

  return subscribeToPush(vapidPublicKey);
}

export function subscriptionToJSON(subscription: PushSubscription): StoredSubscription {
  const json = subscription.toJSON();

  return {
    endpoint: subscription.endpoint,
    expirationTime: subscription.expirationTime ?? null,
    keys: {
      p256dh: json.keys?.p256dh ?? '',
      auth: json.keys?.auth ?? '',
    },
  };
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const normalized = base64String.trim();
  if (normalized.length === 0) {
    throw new Error('La clave VAPID pública está vacía.');
  }

  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
  const base64 = (normalized + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);

  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }

  return bytes;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  return 'Error desconocido.';
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);

    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(message));
      },
    );
  });
}
