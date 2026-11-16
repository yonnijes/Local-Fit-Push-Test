import { AdminTokenField } from './components/AdminTokenField';
import { Controls } from './components/Controls';
import { Header } from './components/Header';
import { InstallGuide } from './components/InstallGuide';
import { Maintenance } from './components/Maintenance';
import { Notice } from './components/Notice';
import { PermissionGuide } from './components/PermissionGuide';
import { RunInfo } from './components/RunInfo';
import { StatusPanel } from './components/StatusPanel';
import { usePushTest } from './hooks/usePushTest';

export default function App() {
  const push = usePushTest();
  const subscriptionRegistered = push.status?.subscriptionRegistered ?? false;
  const backendOnline = push.backend === 'online';
  const anyBusy = push.busy !== null && push.busy !== 'refresh';

  return (
    <div className="app-shell">
      <Header />

      <main className="app-main">
        {push.iosOutdated ? (
          <Notice tone="bad" title="iOS no compatible">
            Web Push en iOS requiere iOS/iPadOS 16.4 o superior y la app instalada en la pantalla
            de inicio.
          </Notice>
        ) : null}

        {!push.support.supported && !push.iosOutdated ? (
          <Notice tone="bad" title="Navegador no compatible">
            {push.support.reason ?? 'Este navegador no puede recibir notificaciones Push.'}
          </Notice>
        ) : null}

        {push.support.supported && !push.standalone ? <InstallGuide ios={push.ios} /> : null}

        {push.permission === 'denied' ? <PermissionGuide ios={push.ios} /> : null}

        {push.config && !push.config.vapidConfigured ? (
          <Notice tone="bad" title="VAPID no configurado en el backend">
            {push.config.vapidError ??
              'Genera las claves con "pnpm vapid:keys" y configúralas en el archivo .env.'}
          </Notice>
        ) : null}

        {push.actionError ? (
          <Notice tone="bad" title="No se pudo completar la acción" onClose={push.clearMessages}>
            {push.actionError}
          </Notice>
        ) : null}

        {push.actionNotice ? (
          <Notice tone="info" onClose={push.clearMessages}>
            {push.actionNotice}
          </Notice>
        ) : null}

        <StatusPanel
          support={push.support}
          ios={push.ios}
          iosOutdated={push.iosOutdated}
          standalone={push.standalone}
          permission={push.permission}
          swReady={push.swReady}
          swError={push.swError}
          localSubscription={push.localSubscription}
          backend={push.backend}
          backendError={push.backendError}
          status={push.status}
        />

        <Controls
          busy={push.busy}
          supported={push.support.supported}
          standalone={push.standalone}
          permission={push.permission}
          subscriptionRegistered={subscriptionRegistered}
          timerRunning={push.status?.timerRunning ?? false}
          backendOnline={backendOnline}
          onActivate={push.activate}
          onSendTest={push.sendTest}
          onStart={push.start}
          onStop={push.stop}
        />

        <RunInfo status={push.status} config={push.config} />

        <AdminTokenField hasToken={push.hasAdminToken} onSave={push.saveToken} />

        <Maintenance busy={anyBusy} onRefresh={push.refresh} onRenew={push.renew} />

        <Notice tone="neutral" title="Aceptado no es recibido">
          El backend solo puede confirmar que el servicio push aceptó el mensaje. iOS puede
          retrasar, agrupar u omitir la visualización según sus políticas.
        </Notice>
      </main>

      <footer className="app-footer">
        <span>MVP de pruebas · Sin Firebase ni OneSignal</span>
        <span className="app-footer__tech">PWA · VAPID · Web Push</span>
      </footer>
    </div>
  );
}
