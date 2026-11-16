import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Resuelve el token de administración.
 *
 * - Si PUSH_TEST_ADMIN_TOKEN está definido se usa ese valor.
 * - Si no, se genera uno aleatorio por proceso y se imprime una única vez.
 *   Así el backend nunca queda abierto por olvido al exponerlo con un túnel.
 *
 * El token jamás se envía al frontend: la PWA lo pide al usuario y lo guarda
 * en el navegador, nunca en el bundle.
 */
@Injectable()
export class AdminTokenService {
  private readonly logger = new Logger('AdminToken');
  private readonly token: string;
  readonly generated: boolean;

  constructor(config: ConfigService) {
    const configured = config.get<string>('PUSH_TEST_ADMIN_TOKEN')?.trim();

    if (configured) {
      this.token = configured;
      this.generated = false;
      return;
    }

    this.token = randomBytes(24).toString('base64url');
    this.generated = true;
    this.logger.warn('PUSH_TEST_ADMIN_TOKEN no está definido.');
    this.logger.warn(`Token de administración generado para esta sesión: ${this.token}`);
    this.logger.warn(
      'Pégalo en la sección "Avanzado" de la PWA o defínelo en .env para fijarlo.',
    );
  }

  /** Comparación en tiempo constante. */
  matches(candidate: string | undefined): boolean {
    if (!candidate) return false;

    const provided = Buffer.from(candidate, 'utf8');
    const expected = Buffer.from(this.token, 'utf8');

    if (provided.length !== expected.length) return false;
    return timingSafeEqual(provided, expected);
  }
}
