import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'node:path';
import { PushModule } from './push/push.module';

function resolveEnvFiles(): string[] {
  const candidates = [
    process.env.ENV_FILE,
    join(process.cwd(), '.env'),
    join(process.cwd(), '..', '..', '.env'),
    join(__dirname, '..', '..', '..', '.env'),
    join(__dirname, '..', '..', '..', '..', '.env'),
  ];

  return [...new Set(candidates.filter((value): value is string => Boolean(value)))];
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: resolveEnvFiles(),
    }),
    PushModule,
  ],
})
export class AppModule {}
