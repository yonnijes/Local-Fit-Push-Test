interface PermissionGuideProps {
  ios: boolean;
}

export function PermissionGuide({ ios }: PermissionGuideProps) {
  return (
    <section className="card card--guide" aria-labelledby="permission-title">
      <div className="card__head">
        <h2 id="permission-title">Permiso de notificaciones denegado</h2>
        <span className="badge badge--bad">Bloqueado</span>
      </div>

      {ios ? (
        <ol className="steps">
          <li>
            Abre <strong>Ajustes</strong> en el iPhone.
          </li>
          <li>
            Entra en <strong>Notificaciones</strong>.
          </li>
          <li>
            Selecciona <strong>Local Fit Push Test</strong>.
          </li>
          <li>
            Activa <strong>Permitir notificaciones</strong>.
          </li>
          <li>Cierra y vuelve a abrir la app desde la pantalla de inicio.</li>
        </ol>
      ) : (
        <ol className="steps">
          <li>Abre los ajustes de permisos del sitio en el navegador.</li>
          <li>Permite las notificaciones para este origen.</li>
          <li>Recarga la página y vuelve a pulsar «Activar notificaciones».</li>
        </ol>
      )}

      <p className="footnote">
        iOS no vuelve a mostrar el diálogo de permiso después de un rechazo. Hay que cambiarlo
        manualmente en Ajustes.
      </p>
    </section>
  );
}
