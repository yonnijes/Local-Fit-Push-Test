import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PushService } from './push.service';
import { DEFAULT_INTERVAL_SECONDS } from './push.types';

interface TimerRun {
  cancelled: boolean;
  timeout?: NodeJS.Timeout;
  wake?: () => void;
}

export interface TimerStartResult {
  running: boolean;
  intervalSeconds: number;
}

/**
 * Temporizador de envíos.
 *
 * Usa un ciclo asíncrono que espera a que termine cada envío antes de
 * programar el siguiente, así nunca se solapan las peticiones push.
 * No se usa setInterval a propósito.
 */
@Injectable()
export class PushTimerService implements OnModuleDestroy {
  private readonly logger = new Logger(PushTimerService.name);
  private run: TimerRun | null = null;
  private intervalSeconds = DEFAULT_INTERVAL_SECONDS;

  constructor(private readonly push: PushService) {
    this.push.setInvalidationHandler(() => {
      if (this.isRunning()) {
        this.logger.warn('Suscripción invalidada: deteniendo el temporizador.');
        this.stop();
      }
    });
  }

  isRunning(): boolean {
    return this.run !== null;
  }

  currentIntervalSeconds(): number {
    return this.intervalSeconds;
  }

  /**
   * Idempotente: si ya hay un ciclo activo devuelve el estado actual sin
   * crear un segundo temporizador.
   */
  start(intervalSeconds: number = DEFAULT_INTERVAL_SECONDS): TimerStartResult {
    if (this.run) {
      return { running: true, intervalSeconds: this.intervalSeconds };
    }

    this.intervalSeconds = intervalSeconds;

    const run: TimerRun = { cancelled: false };
    this.run = run;

    void this.loop(run, intervalSeconds * 1000);

    return { running: true, intervalSeconds };
  }

  stop(): { running: false } {
    const run = this.run;
    this.run = null;

    if (run) {
      run.cancelled = true;

      if (run.timeout) {
        clearTimeout(run.timeout);
        run.timeout = undefined;
      }

      // Despierta la espera en curso para que el ciclo termine de inmediato.
      run.wake?.();
      run.wake = undefined;
    }

    return { running: false };
  }

  onModuleDestroy(): void {
    this.stop();
  }

  private async loop(run: TimerRun, intervalMs: number): Promise<void> {
    this.logger.log(`Temporizador iniciado: primer envío inmediato, luego cada ${intervalMs / 1000}s.`);

    while (!run.cancelled) {
      const result = await this.push.send();

      if (run.cancelled) break;

      if (result.invalidSubscription) {
        this.logger.warn('Temporizador detenido porque la suscripción ya no es válida.');
        break;
      }

      await this.sleep(run, intervalMs);
    }

    if (this.run === run) {
      this.run = null;
    }

    this.logger.log('Temporizador detenido.');
  }

  private sleep(run: TimerRun, ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      if (run.cancelled) {
        resolve();
        return;
      }

      const timer = setTimeout(() => {
        run.timeout = undefined;
        run.wake = undefined;
        resolve();
      }, ms);

      run.timeout = timer;
      run.wake = () => {
        run.timeout = undefined;
        run.wake = undefined;
        resolve();
      };
    });
  }
}
