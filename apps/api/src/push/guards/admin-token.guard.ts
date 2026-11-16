import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { AdminTokenService } from './admin-token.service';

const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/**
 * Protege los endpoints de administración (subscribe, send-test, start, stop).
 *
 * Reglas:
 * 1. Peticiones directas desde loopback (curl local, sin proxy) no necesitan token.
 * 2. Si PUBLIC_APP_URL está definido y la petición trae Origin, debe coincidir.
 * 3. En cualquier otro caso se exige el header x-push-admin-token.
 */
@Injectable()
export class AdminTokenGuard implements CanActivate {
  constructor(
    private readonly tokens: AdminTokenService,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    // Un túnel (Cloudflare u otro) reenvía desde loopback, por eso además se
    // comprueba que no vengan cabeceras de proxy.
    if (isDirectLoopback(request)) return true;

    this.assertAllowedOrigin(request);

    const provided = request.header('x-push-admin-token') ?? undefined;
    if (!this.tokens.matches(provided)) {
      throw new UnauthorizedException(
        'Token de administración requerido o inválido (header x-push-admin-token)',
      );
    }

    return true;
  }

  private assertAllowedOrigin(request: Request): void {
    const allowed = this.config
      .get<string>('PUBLIC_APP_URL')
      ?.trim()
      .replace(/\/+$/, '');
    const origin = request.header('origin');

    if (!allowed || !origin) return;

    if (origin.replace(/\/+$/, '') !== allowed) {
      throw new ForbiddenException('Origen no permitido');
    }
  }
}

function isDirectLoopback(request: Request): boolean {
  const remote = request.socket?.remoteAddress ?? '';
  if (!LOOPBACK_ADDRESSES.has(remote)) return false;

  const proxied = Boolean(
    request.header('cf-connecting-ip') ??
      request.header('x-forwarded-for') ??
      request.header('x-real-ip'),
  );

  return !proxied;
}
