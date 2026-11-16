import { useCallback, useEffect, useRef, useState } from 'react';
import type { PushConfig, PushStatus } from '../types';
import { ApiError, api, getAdminToken, setAdminToken } from '../services/api';
import {
  type BrowserSupport,
  errorMessage,
  getBrowserSupport,
  getExistingSubscription,
  getPermissionState,
  getServiceWorkerRegistration,
  isIOS,
  isIosOutdated,
  isStandalone,
  renewPushSubscription,
  requestNotificationPermission,
  subscribeToPush,
  subscriptionToJSON,
} from '../services/push.service';

export type BackendState = 'checking' | 'online' | 'offline';
export type BusyAction = 'activate' | 'send-test' | 'start' | 'stop' | 'renew' | 'refresh' | null;
export type PermissionState = NotificationPermission | 'unsupported';

const STATUS_POLL_MS = 5_000;

export interface PushTestController {
  support: BrowserSupport;
  ios: boolean;
  iosOutdated: boolean;
  standalone: boolean;
  permission: PermissionState;
  swReady: boolean;
  swError: string | null;
  localSubscription: boolean;
  config: PushConfig | null;
  status: PushStatus | null;
  backend: BackendState;
  backendError: string | null;
  busy: BusyAction;
  actionError: string | null;
  actionNotice: string | null;
  hasAdminToken: boolean;
  activate: () => Promise<void>;
  sendTest: () => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  renew: () => Promise<void>;
  refresh: () => Promise<void>;
  saveToken: (token: string) => void;
  clearMessages: () => void;
}

export function usePushTest(): PushTestController {
  const [support] = useState<BrowserSupport>(() => getBrowserSupport());
  const [ios] = useState<boolean>(() => isIOS());
  const [iosOutdated] = useState<boolean>(() => isIosOutdated());
  const [standalone, setStandalone] = useState<boolean>(() => isStandalone());
  const [permission, setPermission] = useState<PermissionState>(() => getPermissionState());

  const [swReady, setSwReady] = useState(false);
  const [swError, setSwError] = useState<string | null>(null);
  const [localSubscription, setLocalSubscription] = useState(false);

  const [config, setConfig] = useState<PushConfig | null>(null);
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [backend, setBackend] = useState<BackendState>('checking');
  const [backendError, setBackendError] = useState<string | null>(null);

  const [busy, setBusy] = useState<BusyAction>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [hasAdminToken, setHasAdminToken] = useState<boolean>(() => getAdminToken().length > 0);

  const resyncedRef = useRef(false);

  const refreshStatus = useCallback(async (): Promise<PushStatus | null> => {
    try {
      const nextStatus = await api.getStatus();
      setStatus(nextStatus);
      setBackend('online');
      setBackendError(null);
      return nextStatus;
    } catch (error) {
      setBackend('offline');
      setBackendError(errorMessage(error));
      return null;
    }
  }, []);

  const loadConfiguration = useCallback(async (): Promise<PushConfig> => {
    const nextConfig = await api.getConfig();
    setConfig(nextConfig);
    return nextConfig;
  }, []);

  // Registro del Service Worker, estado inicial del permiso y configuración.
  useEffect(() => {
    let disposed = false;

    const boot = async (): Promise<void> => {
      if (support.supported) {
        try {
          const registration = await getServiceWorkerRegistration();
          if (disposed) return;

          setSwReady(Boolean(registration.active));
          setSwError(null);

          const subscription = await registration.pushManager.getSubscription();
          if (disposed) return;
          setLocalSubscription(Boolean(subscription));
        } catch (error) {
          if (disposed) return;
          setSwReady(false);
          setSwError(errorMessage(error));
        }
      }

      try {
        const nextConfig = await api.getConfig();
        if (disposed) return;
        setConfig(nextConfig);
      } catch (error) {
        if (disposed) return;
        setBackendError(errorMessage(error));
      }
    };

    void boot();

    return () => {
      disposed = true;
    };
  }, [support.supported]);

  // Polling del estado del backend.
  useEffect(() => {
    void refreshStatus();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshStatus();
    }, STATUS_POLL_MS);

    const handleWakeUp = (): void => {
      if (document.visibilityState === 'visible') void refreshStatus();
    };

    document.addEventListener('visibilitychange', handleWakeUp);
    window.addEventListener('online', handleWakeUp);
    window.addEventListener('offline', handleWakeUp);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleWakeUp);
      window.removeEventListener('online', handleWakeUp);
      window.removeEventListener('offline', handleWakeUp);
    };
  }, [refreshStatus]);

  // El permiso puede cambiar desde Ajustes mientras la app está en segundo plano.
  useEffect(() => {
    const updatePermission = (): void => {
      setPermission(getPermissionState());
      setStandalone(isStandalone());
    };

    document.addEventListener('visibilitychange', updatePermission);
    window.addEventListener('focus', updatePermission);

    return () => {
      document.removeEventListener('visibilitychange', updatePermission);
      window.removeEventListener('focus', updatePermission);
    };
  }, []);

  // Tras reiniciar el backend se pierde la suscripción en memoria: si el
  // dispositivo ya la tiene, se vuelve a registrar automáticamente.
  useEffect(() => {
    if (resyncedRef.current) return;
    // Una activación manual ya registra la suscripción: no duplicar el POST
    // mientras el estado del backend aún es el anterior.
    if (busy !== null) return;
    if (!support.supported || permission !== 'granted' || !localSubscription) return;
    if (!status || status.subscriptionRegistered) return;

    resyncedRef.current = true;

    void (async () => {
      try {
        const subscription = await getExistingSubscription();
        if (!subscription) return;

        await api.subscribe(subscriptionToJSON(subscription));
        setActionNotice('Suscripción re-sincronizada con el backend.');
        await refreshStatus();
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          setActionNotice(
            'El backend no tiene tu suscripción. Guarda el token de administración para sincronizarla.',
          );
          return;
        }
        if (error instanceof ApiError && error.status === 0) return;
        setActionNotice(`No se pudo re-sincronizar la suscripción: ${errorMessage(error)}`);
      }
    })();
  }, [support.supported, permission, localSubscription, status, busy, refreshStatus]);

  const activate = useCallback(async (): Promise<void> => {
    setActionError(null);
    setActionNotice(null);
    setBusy('activate');

    try {
      if (!support.supported) {
        throw new Error(support.reason ?? 'Este navegador no soporta notificaciones Push.');
      }
      if (!standalone) {
        throw new Error(
          'La PWA debe estar instalada en la pantalla de inicio para solicitar el permiso.',
        );
      }

      const currentPermission = getPermissionState();
      if (currentPermission === 'denied') {
        throw new Error(
          'El permiso está denegado. En iOS ve a Ajustes → Notificaciones → Local Fit Push Test, actívalo y vuelve a abrir la app.',
        );
      }

      // Importante: la petición de permiso debe iniciarse sin awaits previos
      // para conservar el gesto del usuario (requisito de iOS).
      const nextPermission =
        currentPermission === 'granted'
          ? currentPermission
          : await requestNotificationPermission();

      setPermission(nextPermission);

      if (nextPermission !== 'granted') {
        throw new Error(
          'No se concedió el permiso de notificaciones. Puedes habilitarlo desde Ajustes → Notificaciones.',
        );
      }

      const activeConfig = config ?? (await loadConfiguration());
      if (!activeConfig.vapidConfigured || !activeConfig.vapidPublicKey) {
        throw new Error(
          activeConfig.vapidError ??
            'El backend no tiene claves VAPID configuradas. Revisa el archivo .env.',
        );
      }

      const subscription = await subscribeToPush(activeConfig.vapidPublicKey);
      await api.subscribe(subscriptionToJSON(subscription));

      setLocalSubscription(true);
      setSwReady(true);
      setSwError(null);
      setActionNotice('Dispositivo registrado. Ya puedes enviar una notificación de prueba.');
      await refreshStatus();
    } catch (error) {
      setActionError(describeActionError(error));
    } finally {
      setBusy(null);
    }
  }, [support, standalone, config, loadConfiguration, refreshStatus]);

  const sendTest = useCallback(async (): Promise<void> => {
    setActionError(null);
    setActionNotice(null);
    setBusy('send-test');

    try {
      if (!status?.subscriptionRegistered) {
        throw new Error('Activa las notificaciones antes de enviar una prueba.');
      }

      await api.sendTest();
      setActionNotice(
        'Solicitud aceptada por el servicio push. Comprueba el iPhone; la entrega no está garantizada.',
      );
      await refreshStatus();
    } catch (error) {
      setActionError(describeActionError(error));
    } finally {
      setBusy(null);
    }
  }, [status?.subscriptionRegistered, refreshStatus]);

  const start = useCallback(async (): Promise<void> => {
    setActionError(null);
    setActionNotice(null);
    setBusy('start');

    try {
      if (!status?.subscriptionRegistered) {
        throw new Error('Activa las notificaciones antes de iniciar el temporizador.');
      }

      const interval = config?.defaultIntervalSeconds ?? 30;
      const result = await api.start(interval);
      setActionNotice(`Temporizador iniciado: un envío cada ${result.intervalSeconds} s.`);
      await refreshStatus();
    } catch (error) {
      setActionError(describeActionError(error));
    } finally {
      setBusy(null);
    }
  }, [status?.subscriptionRegistered, config?.defaultIntervalSeconds, refreshStatus]);

  const stop = useCallback(async (): Promise<void> => {
    setActionError(null);
    setActionNotice(null);
    setBusy('stop');

    try {
      await api.stop();
      setActionNotice('Temporizador detenido. La suscripción sigue registrada.');
      await refreshStatus();
    } catch (error) {
      setActionError(describeActionError(error));
    } finally {
      setBusy(null);
    }
  }, [refreshStatus]);

  const renew = useCallback(async (): Promise<void> => {
    setActionError(null);
    setActionNotice(null);
    setBusy('renew');

    try {
      if (permission !== 'granted') {
        throw new Error('Concede el permiso de notificaciones antes de renovar la suscripción.');
      }

      const activeConfig = config ?? (await loadConfiguration());
      if (!activeConfig.vapidPublicKey) {
        throw new Error('El backend no expuso una clave pública VAPID.');
      }

      const subscription = await renewPushSubscription(activeConfig.vapidPublicKey);
      await api.subscribe(subscriptionToJSON(subscription));

      setLocalSubscription(true);
      setActionNotice('Suscripción renovada y registrada de nuevo en el backend.');
      await refreshStatus();
    } catch (error) {
      setActionError(describeActionError(error));
    } finally {
      setBusy(null);
    }
  }, [permission, config, loadConfiguration, refreshStatus]);

  const refresh = useCallback(async (): Promise<void> => {
    setBusy('refresh');
    try {
      await Promise.all([loadConfiguration(), refreshStatus()]);
    } catch (error) {
      setBackendError(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }, [loadConfiguration, refreshStatus]);

  const saveToken = useCallback((token: string): void => {
    setAdminToken(token);
    setHasAdminToken(token.trim().length > 0);
    setActionError(null);
    setActionNotice(
      token.trim().length > 0
        ? 'Token guardado en este dispositivo.'
        : 'Token eliminado de este dispositivo.',
    );
  }, []);

  const clearMessages = useCallback((): void => {
    setActionError(null);
    setActionNotice(null);
  }, []);

  return {
    support,
    ios,
    iosOutdated,
    standalone,
    permission,
    swReady,
    swError,
    localSubscription,
    config,
    status,
    backend,
    backendError,
    busy,
    actionError,
    actionNotice,
    hasAdminToken,
    activate,
    sendTest,
    start,
    stop,
    renew,
    refresh,
    saveToken,
    clearMessages,
  };
}

function describeActionError(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 401:
        return 'Token de administración requerido o inválido. Pégalo en la sección "Avanzado".';
      case 403:
        return 'El origen de la petición no coincide con PUBLIC_APP_URL.';
      case 503:
        return `Servicio no disponible: ${error.message}`;
      case 0:
        return `No se pudo contactar con el backend: ${error.message}`;
      default:
        return error.message;
    }
  }

  return errorMessage(error);
}
