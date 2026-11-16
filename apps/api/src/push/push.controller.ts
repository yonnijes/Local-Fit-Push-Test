import {
  Body,
  ConflictException,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpException,
  Post,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { AdminTokenGuard } from './guards/admin-token.guard';
import { SubscribeDto } from './dto/subscribe.dto';
import { StartDto } from './dto/start.dto';
import { NOTIFICATION_BODY_TEMPLATE, NOTIFICATION_TITLE, PushService } from './push.service';
import { PushTimerService } from './push-timer.service';
import {
  DEFAULT_INTERVAL_SECONDS,
  MANUAL_SEND_COOLDOWN_MS,
  MAX_INTERVAL_SECONDS,
  MIN_INTERVAL_SECONDS,
  type PushStatus,
} from './push.types';

@Controller('push')
export class PushController {
  private lastManualSendAt = 0;

  constructor(
    private readonly push: PushService,
    private readonly timer: PushTimerService,
  ) {}

  @Get('status')
  @Header('Cache-Control', 'no-store')
  getStatus(): PushStatus {
    return {
      ...this.push.getStatus(),
      timerRunning: this.timer.isRunning(),
      intervalSeconds: this.timer.currentIntervalSeconds(),
    };
  }

  @Get('config')
  @Header('Cache-Control', 'no-store')
  getConfig() {
    return {
      vapidPublicKey: this.push.getPublicKey(),
      vapidConfigured: this.push.isReady(),
      vapidError: this.push.getConfigurationError(),
      intervalSeconds: this.timer.currentIntervalSeconds(),
      defaultIntervalSeconds: DEFAULT_INTERVAL_SECONDS,
      minIntervalSeconds: MIN_INTERVAL_SECONDS,
      maxIntervalSeconds: MAX_INTERVAL_SECONDS,
      adminTokenRequired: true,
      notificationTitle: NOTIFICATION_TITLE,
      notificationBodyTemplate: NOTIFICATION_BODY_TEMPLATE,
    };
  }

  @Post('subscribe')
  @HttpCode(200)
  @UseGuards(AdminTokenGuard)
  subscribe(@Body() dto: SubscribeDto): { registered: true } {
    this.push.register({
      endpoint: dto.endpoint,
      expirationTime: dto.expirationTime ?? null,
      keys: {
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
      },
    });

    return { registered: true };
  }

  @Post('send-test')
  @HttpCode(200)
  @UseGuards(AdminTokenGuard)
  async sendTest(): Promise<{ accepted: true; message: string }> {
    this.assertReadyToSend();

    const now = Date.now();
    if (now - this.lastManualSendAt < MANUAL_SEND_COOLDOWN_MS) {
      throw new HttpException(
        {
          accepted: false,
          message: 'Espera unos segundos antes de enviar otra notificación manual.',
        },
        429,
      );
    }
    this.lastManualSendAt = now;

    const result = await this.push.send();

    if (!result.accepted) {
      throw new HttpException(
        {
          accepted: false,
          message: result.error ?? 'El servicio push rechazó la notificación.',
        },
        result.invalidSubscription ? 410 : 502,
      );
    }

    return { accepted: true, message: 'Test push submitted' };
  }

  @Post('start')
  @HttpCode(200)
  @UseGuards(AdminTokenGuard)
  start(@Body() dto: StartDto) {
    this.assertReadyToSend();

    return this.timer.start(dto.intervalSeconds ?? DEFAULT_INTERVAL_SECONDS);
  }

  @Post('stop')
  @HttpCode(200)
  @UseGuards(AdminTokenGuard)
  stop() {
    return this.timer.stop();
  }

  private assertReadyToSend(): void {
    if (!this.push.hasSubscription()) {
      throw new ConflictException(
        'No hay ninguna suscripción registrada. Activa las notificaciones primero.',
      );
    }

    if (!this.push.isReady()) {
      throw new ServiceUnavailableException(
        this.push.getConfigurationError() ?? 'VAPID no está configurado en el backend.',
      );
    }
  }
}
