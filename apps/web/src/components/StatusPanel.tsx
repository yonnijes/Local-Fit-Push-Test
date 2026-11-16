import type { PushStatus, StatusTone } from '../types';
import type { BackendState, PermissionState } from '../hooks/usePushTest';
import type { BrowserSupport } from '../services/push.service';

interface StatusPanelProps {
  support: BrowserSupport;
  ios: boolean;
  iosOutdated: boolean;
  standalone: boolean;
  permission: PermissionState;
  swReady: boolean;
  swError: string | null;
  localSubscription: boolean;
  backend: BackendState;
  backendError: string | null;
  status: PushStatus | null;
}

interface StatusRow {
  label: string;
  value: string;
  tone: StatusTone;
  detail?: string;
}

export function StatusPanel(props: StatusPanelProps) {
  const rows: StatusRow[] = [
    {
      label: 'Compatibilidad',
      value: props.support.supported ? 'Soportada' : 'No soportada',
      tone: props.support.supported ? 'ok' : 'bad',
      detail: props.support.reason ?? (props.ios ? 'iOS detectado' : undefined),
    },
    {
      label: 'Instalación PWA',
      value: props.standalone ? 'Instalada' : 'En navegador',
      tone: props.standalone ? 'ok' : 'warn',
      detail: props.standalone
        ? 'Ejecutándose en modo standalone'
        : 'Abre la app desde el icono de la pantalla de inicio',
    },
    {
      label: 'Permiso',
      value: permissionLabel(props.permission),
      tone: permissionTone(props.permission),
      detail:
        props.permission === 'denied'
          ? 'Habilítalo desde Ajustes → Notificaciones'
          : undefined,
    },
    {
      label: 'Service Worker',
      value: props.swReady ? 'Activo' : props.swError ? 'Error' : 'Registrando…',
      tone: props.swReady ? 'ok' : props.swError ? 'bad' : 'warn',
      detail: props.swError ?? undefined,
    },
    {
      label: 'Suscripción push',
      value: subscriptionLabel(props.status?.subscriptionRegistered, props.localSubscription),
      tone: subscriptionTone(props.status?.subscriptionRegistered, props.localSubscription),
      detail:
        props.localSubscription && props.status && !props.status.subscriptionRegistered
          ? 'El dispositivo tiene suscripción, el backend aún no'
          : undefined,
    },
    {
      label: 'Backend',
      value: backendLabel(props.backend),
      tone: props.backend === 'online' ? 'ok' : props.backend === 'offline' ? 'bad' : 'warn',
      detail: props.backend === 'offline' ? (props.backendError ?? undefined) : undefined,
    },
  ];

  return (
    <section className="card" aria-labelledby="device-status-title">
      <div className="card__head">
        <h2 id="device-status-title">Estado del dispositivo</h2>
        {props.iosOutdated ? <span className="badge badge--warn">iOS &lt; 16.4</span> : null}
      </div>

      <ul className="status-list">
        {rows.map((row) => (
          <li className="status-row" key={row.label}>
            <span className={`dot dot--${row.tone}`} aria-hidden="true" />
            <div className="status-row__copy">
              <span className="status-row__label">{row.label}</span>
              {row.detail ? <span className="status-row__detail">{row.detail}</span> : null}
            </div>
            <span className={`status-row__value status-row__value--${row.tone}`}>{row.value}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function permissionLabel(permission: PermissionState): string {
  switch (permission) {
    case 'granted':
      return 'Concedido';
    case 'denied':
      return 'Denegado';
    case 'default':
      return 'Sin solicitar';
    default:
      return 'No disponible';
  }
}

function permissionTone(permission: PermissionState): StatusTone {
  switch (permission) {
    case 'granted':
      return 'ok';
    case 'denied':
      return 'bad';
    case 'default':
      return 'warn';
    default:
      return 'bad';
  }
}

function subscriptionLabel(registered: boolean | undefined, local: boolean): string {
  if (registered && local) return 'Registrada';
  if (registered) return 'Registrada en backend';
  if (local) return 'Pendiente de sincronizar';
  return 'Sin registrar';
}

function subscriptionTone(registered: boolean | undefined, local: boolean): StatusTone {
  if (registered && local) return 'ok';
  if (registered || local) return 'warn';
  return 'neutral';
}

function backendLabel(backend: BackendState): string {
  switch (backend) {
    case 'online':
      return 'Conectado';
    case 'offline':
      return 'Desconectado';
    default:
      return 'Comprobando…';
  }
}
