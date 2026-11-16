import type { PushConfig, PushStatus } from '../types';

interface RunInfoProps {
  status: PushStatus | null;
  config: PushConfig | null;
}

export function RunInfo({ status, config }: RunInfoProps) {
  const interval = status?.intervalSeconds ?? config?.defaultIntervalSeconds ?? 30;

  return (
    <section className="card" aria-labelledby="run-info-title">
      <div className="card__head">
        <h2 id="run-info-title">Información de ejecución</h2>
      </div>

      <dl className="metrics">
        <div className="metric">
          <dt>Intervalo</dt>
          <dd>{interval} s</dd>
        </div>
        <div className="metric">
          <dt>Temporizador</dt>
          <dd className={status?.timerRunning ? 'text-ok' : undefined}>
            {status?.timerRunning ? 'Activo' : 'Detenido'}
          </dd>
        </div>
        <div className="metric">
          <dt>Envíos aceptados</dt>
          <dd>{status?.sentCount ?? 0}</dd>
        </div>
        <div className="metric">
          <dt>Última secuencia</dt>
          <dd>{status?.sequence ?? 0}</dd>
        </div>
        <div className="metric metric--wide">
          <dt>Último intento</dt>
          <dd>{formatTimestamp(status?.lastAttemptAt)}</dd>
        </div>
        <div className="metric metric--wide">
          <dt>Último error</dt>
          <dd className={status?.lastError ? 'text-bad' : 'text-muted'}>
            {status?.lastError ?? '—'}
          </dd>
        </div>
      </dl>

      <p className="footnote">
        «Envíos aceptados» cuenta las notificaciones aceptadas por el servicio push. No garantiza
        que iOS las haya mostrado.
      </p>
    </section>
  );
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('es', {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(date);
}
