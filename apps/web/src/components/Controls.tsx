import type { BusyAction, PermissionState } from '../hooks/usePushTest';

interface ControlsProps {
  busy: BusyAction;
  supported: boolean;
  standalone: boolean;
  permission: PermissionState;
  subscriptionRegistered: boolean;
  timerRunning: boolean;
  backendOnline: boolean;
  onActivate: () => Promise<void>;
  onSendTest: () => Promise<void>;
  onStart: () => Promise<void>;
  onStop: () => Promise<void>;
}

export function Controls(props: ControlsProps) {
  const anyBusy = props.busy !== null && props.busy !== 'refresh';

  const activateBlocked = !props.supported
    ? 'Push no soportado en este navegador'
    : !props.standalone
      ? 'Instala la PWA primero'
      : props.permission === 'denied'
        ? 'Permiso denegado en Ajustes'
        : null;

  const sendBlocked = !props.subscriptionRegistered
    ? 'Activa las notificaciones primero'
    : !props.backendOnline
      ? 'Backend desconectado'
      : null;

  const startBlocked = !props.subscriptionRegistered
    ? 'Activa las notificaciones primero'
    : !props.backendOnline
      ? 'Backend desconectado'
      : props.timerRunning
        ? 'El temporizador ya está activo'
        : null;

  return (
    <section className="card" aria-labelledby="controls-title">
      <div className="card__head">
        <h2 id="controls-title">Controles</h2>
        <span className={`chip ${props.timerRunning ? 'chip--live' : ''}`}>
          {props.timerRunning ? 'RUNNING' : 'IDLE'}
        </span>
      </div>

      <div className="controls">
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => void props.onActivate()}
          disabled={anyBusy || activateBlocked !== null}
          title={activateBlocked ?? undefined}
        >
          <span>{props.busy === 'activate' ? 'Activando…' : 'Activar notificaciones'}</span>
          {activateBlocked ? <span className="btn__hint">{activateBlocked}</span> : null}
        </button>

        <button
          type="button"
          className="btn btn--secondary"
          onClick={() => void props.onSendTest()}
          disabled={anyBusy || sendBlocked !== null}
          title={sendBlocked ?? undefined}
        >
          <span>{props.busy === 'send-test' ? 'Enviando…' : 'Enviar prueba ahora'}</span>
          {sendBlocked ? <span className="btn__hint">{sendBlocked}</span> : null}
        </button>

        <button
          type="button"
          className="btn btn--start"
          onClick={() => void props.onStart()}
          disabled={anyBusy || startBlocked !== null}
          title={startBlocked ?? undefined}
        >
          <span>{props.busy === 'start' ? 'Iniciando…' : 'Iniciar prueba'}</span>
          {startBlocked ? <span className="btn__hint">{startBlocked}</span> : null}
        </button>

        <button
          type="button"
          className="btn btn--stop"
          onClick={() => void props.onStop()}
          disabled={anyBusy || !props.timerRunning}
          title={!props.timerRunning ? 'El temporizador está detenido' : undefined}
        >
          <span>{props.busy === 'stop' ? 'Deteniendo…' : 'Detener prueba'}</span>
          {!props.timerRunning ? <span className="btn__hint">Sin temporizador activo</span> : null}
        </button>
      </div>
    </section>
  );
}
