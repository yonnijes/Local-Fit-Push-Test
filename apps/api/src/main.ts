import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { existsSync } from 'node:fs';
import type { ServerResponse } from 'node:http';
import { extname, join } from 'node:path';
import { AppModule } from './app.module';
import { resolveWebDistPath } from './web-dist';

const logger = new Logger('Bootstrap');

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.disable('x-powered-by');
  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: true,
    }),
  );

  mountFrontend(app);

  app.enableShutdownHooks();

  const port = Number(config.get<string>('PORT') ?? 3000);
  await app.listen(port, '0.0.0.0');

  logger.log(`API escuchando en http://localhost:${port}/api/push`);
  logger.log('Recuerda exponer el puerto con Cloudflare Tunnel para usar la PWA en iOS.');
}

function mountFrontend(app: NestExpressApplication): void {
  const webDist = resolveWebDistPath();
  const indexFile = join(webDist, 'index.html');

  if (!existsSync(indexFile)) {
    logger.warn(
      `No se encontró el build del frontend en ${webDist}. Ejecuta "pnpm build" para servir la PWA desde este backend.`,
    );
    return;
  }

  app.useStaticAssets(webDist, {
    index: false,
    etag: true,
    lastModified: true,
    setHeaders: setStaticHeaders,
  });

  // Fallback SPA: cualquier GET sin extensión que no sea /api devuelve index.html.
  app.use((request: Request, response: Response, next: NextFunction) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') return next();
    if (request.path === '/api' || request.path.startsWith('/api/')) return next();
    if (extname(request.path) !== '') return next();

    response.setHeader('Cache-Control', 'no-store');
    response.sendFile(indexFile);
  });

  logger.log(`Frontend estático servido desde ${webDist}`);
}

function setStaticHeaders(response: ServerResponse, filePath: string): void {
  const isServiceWorker = /(?:^|\/)(?:sw|dev-sw)\.js$/.test(filePath);
  const isEntryPoint = /\.(?:html|webmanifest)$/.test(filePath);

  if (isServiceWorker || isEntryPoint) {
    response.setHeader('Cache-Control', 'no-store');
    return;
  }

  if (/[\\/]assets[\\/]/.test(filePath)) {
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
}

void bootstrap();
