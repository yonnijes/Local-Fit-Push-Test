export function Header() {
  return (
    <header className="app-header">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          <span className="brand-mark__dot" />
        </span>
        <div className="brand-copy">
          <h1>Local Fit Push Test</h1>
          <p>Aplicación de prueba de notificaciones Push.</p>
        </div>
      </div>
      <span className="badge badge--test">TEST ENVIRONMENT</span>
    </header>
  );
}
