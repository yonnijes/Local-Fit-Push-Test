import { Module } from '@nestjs/common';
import { AdminTokenGuard } from './guards/admin-token.guard';
import { AdminTokenService } from './guards/admin-token.service';
import { PushController } from './push.controller';
import { PushService } from './push.service';
import { PushTimerService } from './push-timer.service';

@Module({
  controllers: [PushController],
  providers: [PushService, PushTimerService, AdminTokenService, AdminTokenGuard],
  exports: [PushService, PushTimerService],
})
export class PushModule {}
