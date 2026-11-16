import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webPush from 'web-push';
import {
  PUSH_TIMEOUT_MS,
  PUSH_TTL_SECONDS,
  type SendResult,
  type StoredSubscription,
} from './push.types';

export const NOTIFICATION_TITLE = 'Local Fit Push Test';
export const NOTIFICATION_BODY_TEMPLATE = 'Notificación de prueba #{sequence}';

interface PushPayload {
  type: 'push-test';
  sequence: number;
  sentAt: string;
  title: string;
  body: string;
  url: string;
}

interface StateSnapshot {
  subscription: StoredSubscription | null;
  sentCount: number;
  sequence: number;
  lastAttemptAt: Date | null;
  lastError: string | null;
}

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);

  private state: StateSnapshot = {
    subscription: null,
    sentCount: 0,
    sequence: 0,
    lastAttemptAt: null,
    lastError: null,
  };

  private vapidReady = false;
  private vapidError: string | null = null;
  private vapidPublicKey: string | null = null;

  private invalidationHandler: (() => void) | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const subject = this.config.get<string>('VAPID_SUBJECT')?.trim();
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY')?.trim();
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY')?.trim();

    if (!subject || !publicKey || !privateKey) {
      this.vapidError =
        'Faltan claves VAPID. Genera un par con "pnpm vapid:keys" y configura VAPID_SUBJECT, VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY en .env.';
      this.logger.error(this.vapidError);
      return;
    }

    try {
      webPush.setVapidDetails(subject, publicKey, privateKey);
      this.vapidReady = true;
      this.vapidPublicKey = publicKey;
      this.logger.log('VAPID configurado correctamente.');
    } catch (error) {
      this.vapidError = `Claves VAPID inválidas: ${describeError(error).message}`;
      this.logger.error(this.vapidError);
    }
  }

  /** El temporizador se suscribe para detenerse ante una suscripción inválida. */
  setInvalidationHandler(handler: () => void): void {
    this.invalidationHandler = handler;
  }

  register(subscription: StoredSubscription): void {
    this.state.subscription = {
      endpoint: subscription.endpoint,
      expirationTime: subscription.expirationTime ?? null,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    };
    this.state.lastError = null;
    this.logger.log('Suscripción push registrada en memoria.');
  }

  getStatus(): {
    subscriptionRegistered: boolean;
    sentCount: number;
    sequence: number;
    lastAttemptAt: string | null;
    lastError: string | null;
  } {
    return {
      subscriptionRegistered: this.state.subscription !== null,
      sentCount: this.state.sentCount,
      sequence: this.state.sequence,
      lastAttemptAt: this.state.lastAttemptAt?.toISOString() ?? null,
      lastError: this.state.lastError,
    };
  }

  hasSubscription(): boolean {
    return this.state.subscription !== null;
  }

  isReady(): boolean {
    return this.vapidReady;
  }

  getPublicKey(): string | null {
    return this.vapidPublicKey;
  }

  getConfigurationError(): string | null {
    return this.vapidError;
  }

  /**
   * Envía una notificación con un identificador de secuencia nuevo.
   * Nunca lanza: devuelve el resultado para que el temporizador pueda decidir
   * si debe detenerse.
   */
  async send(): Promise<SendResult> {
    const subscription = this.state.subscription;

    if (!subscription) {
      return { accepted: false, error: 'No hay ninguna suscripción registrada.' };
    }

    if (!this.vapidReady) {
      return {
        accepted: false,
        error: this.vapidError ?? 'VAPID no está configurado en el backend.',
      };
    }

    const sequence = this.state.sequence + 1;
    const sentAt = new Date().toISOString();
    this.state.sequence = sequence;
    this.state.lastAttemptAt = new Date();

    const payload: PushPayload = {
      type: 'push-test',
      sequence,
      sentAt,
      title: NOTIFICATION_TITLE,
      body: NOTIFICATION_BODY_TEMPLATE.replace('{sequence}', String(sequence)),
      url: '/',
    };

    try {
      const response = await webPush.sendNotification(
        {
          endpoint: subscription.endpoint,
          expirationTime: subscription.expirationTime,
          keys: subscription.keys,
        },
        JSON.stringify(payload),
        {
          TTL: PUSH_TTL_SECONDS,
          urgency: 'high',
          timeout: PUSH_TIMEOUT_MS,
        },
      );

      this.state.sentCount += 1;
      this.state.lastError = null;
      this.logger.log(
        `Push #${sequence} aceptado por el servicio (HTTP ${response.statusCode}).`,
      );

      return { accepted: true, sequence };
    } catch (error) {
      const failure = describeError(error);
      const invalidSubscription = failure.statusCode === 404 || failure.statusCode === 410;

      if (invalidSubscription) {
        this.state.subscription = null;
        this.state.lastError = `Suscripción inválida (HTTP ${failure.statusCode}). Vuelve a pulsar "Activar notificaciones" para registrar el dispositivo de nuevo.`;
        this.logger.warn(
          `Push #${sequence} rechazado: suscripción inválida (HTTP ${failure.statusCode}).`,
        );
        this.invalidationHandler?.();
      } else {
        this.state.lastError = failure.message;
        this.logger.warn(`Push #${sequence} falló: ${failure.message}`);
      }

      return {
        accepted: false,
        sequence,
        error: this.state.lastError ?? failure.message,
        invalidSubscription,
      };
    }
  }
}

function describeError(error: unknown): { statusCode?: number; message: string } {
  const candidate = error as { statusCode?: unknown; message?: unknown };
  const statusCode =
    typeof candidate.statusCode === 'number' ? candidate.statusCode : undefined;

  const rawMessage =
    typeof candidate.message === 'string' && candidate.message.trim().length > 0
      ? candidate.message
      : 'Error desconocido al enviar la notificación push.';

  const technical = truncate(rawMessage, 240);

  if (statusCode === 401 || statusCode === 403) {
    return {
      statusCode,
      message: `El servicio push rechazó la autenticación VAPID (HTTP ${statusCode}). Revisa las claves VAPID o renueva la suscripción.`,
    };
  }

  if (statusCode === 413) {
    return { statusCode, message: 'El payload de la notificación es demasiado grande (HTTP 413).' };
  }

  if (statusCode === 429) {
    return {
      statusCode,
      message: 'El servicio push limitó la frecuencia de envíos (HTTP 429). Inténtalo de nuevo más tarde.',
    };
  }

  if (statusCode && statusCode >= 500) {
    return {
      statusCode,
      message: `Error temporal del servicio push (HTTP ${statusCode}). Se reintentará en el próximo ciclo.`,
    };
  }

  if (statusCode && statusCode >= 400) {
    return {
      statusCode,
      message: `El servicio push rechazó el envío (HTTP ${statusCode}).`,
    };
  }

  return { statusCode, message: technical };
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
}
