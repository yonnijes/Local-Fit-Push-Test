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

export interface PushConfig {
  vapidPublicKey: string | null;
  vapidConfigured: boolean;
  vapidError: string | null;
  intervalSeconds: number;
  defaultIntervalSeconds: number;
  minIntervalSeconds: number;
  maxIntervalSeconds: number;
  adminTokenRequired: boolean;
  notificationTitle: string;
  notificationBodyTemplate: string;
}

export type StatusTone = 'ok' | 'warn' | 'bad' | 'neutral';
