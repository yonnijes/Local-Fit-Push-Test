import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Localiza el build del frontend. Admite despliegues donde el backend se
 * ejecuta desde la raíz del monorepo o desde apps/api.
 */
export function resolveWebDistPath(): string {
  const override = process.env.WEB_DIST_PATH?.trim();
  if (override) return resolve(process.cwd(), override);

  const candidates = [
    // dist/main.js o src/main.ts -> apps/web/dist
    join(__dirname, '..', '..', 'web', 'dist'),
    // ejecutando desde la raíz del monorepo
    join(process.cwd(), 'apps', 'web', 'dist'),
    // ejecutando desde apps/api
    join(process.cwd(), '..', 'web', 'dist'),
  ];

  return candidates.find((candidate) => existsSync(join(candidate, 'index.html'))) ?? candidates[0];
}
