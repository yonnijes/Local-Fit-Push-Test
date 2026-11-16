interface InstallGuideProps {
  ios: boolean;
}

export function InstallGuide({ ios }: InstallGuideProps) {
  return (
    <section className="card card--guide" aria-labelledby="install-title">
      <div className="card__head">
        <h2 id="install-title">Instala la PWA para continuar</h2>
        <span className="badge badge--warn">Pendiente</span>
      </div>

      {ios ? (
        <ol className="steps">
          <li>Abre esta página en Safari (no en Chrome ni en una vista embebida).</li>
          <li>
            Toca el botón <strong>Compartir</strong> de Safari.
          </li>
          <li>
            Elige <strong>Añadir a pantalla de inicio</strong>.
          </li>
          <li>Abre «Local Fit Push Test» desde el nuevo icono.</li>
          <li>Pulsa «Activar notificaciones» dentro de la app instalada.</li>
        </ol>
      ) : (
        <ol className="steps">
          <li>Abre el menú del navegador.</li>
          <li>
            Elige <strong>Instalar aplicación</strong> o <strong>Añadir a pantalla de inicio</strong>.
          </li>
          <li>Abre la app desde el icono y pulsa «Activar notificaciones».</li>
        </ol>
      )}

      <p className="footnote">
        En iOS el permiso de notificaciones solo puede solicitarse desde la app instalada
        (iOS/iPadOS 16.4 o superior).
      </p>
    </section>
  );
}
