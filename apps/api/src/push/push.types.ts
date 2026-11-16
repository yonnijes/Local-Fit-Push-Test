export const DEFAULT_INTERVAL_SECONDS = 30;
export const MIN_INTERVAL_SECONDS = 10;
export const MAX_INTERVAL_SECONDS = 300;

/** Ventana mínima entre envíos manuales para evitar abuso desde el túnel. */
export const MANUAL_SEND_COOLDOWN_MS = 3_000;

/** TTL de la entrega en el servicio push (segundos). */
export const PUSH_TTL_SECONDS = 3_600;

/** Timeout de red contra el servicio push (ms). */
export const PUSH_TIMEOUT_MS = 10_000;

export interface StoredSubscription {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushStatus {
  subscriptionRegistered: boolean;
  timerRunning: boolean;
  intervalSeconds: number;
  sentCount: number;
  sequence: number;
  lastAttemptAt: string | null;
  lastError: string | null;
}

export interface SendResult {
  accepted: boolean;
  sequence?: number;
  error?: string;
  invalidSubscription?: boolean;
}
