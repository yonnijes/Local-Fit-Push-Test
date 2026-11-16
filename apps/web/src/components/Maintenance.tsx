interface MaintenanceProps {
  busy: boolean;
  onRefresh: () => Promise<void>;
  onRenew: () => Promise<void>;
}

export function Maintenance({ busy, onRefresh, onRenew }: MaintenanceProps) {
  return (
    <section className="maintenance" aria-label="Mantenimiento">
      <button
        type="button"
        className="btn btn--small btn--ghost"
        onClick={() => void onRefresh()}
        disabled={busy}
      >
        Actualizar estado
      </button>
      <button
        type="button"
        className="btn btn--small btn--ghost"
        onClick={() => void onRenew()}
        disabled={busy}
        title="Elimina la suscripción local y crea una nueva con la clave VAPID actual"
      >
        Renovar suscripción
      </button>
    </section>
  );
}
