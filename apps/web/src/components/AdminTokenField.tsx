import { useState } from 'react';

interface AdminTokenFieldProps {
  hasToken: boolean;
  onSave: (token: string) => void;
}

export function AdminTokenField({ hasToken, onSave }: AdminTokenFieldProps) {
  const [value, setValue] = useState('');
  const [visible, setVisible] = useState(false);

  return (
    <details className="card details-card">
      <summary className="details-summary">
        <span>Avanzado · Token de administración</span>
        <span className={`badge ${hasToken ? 'badge--ok' : 'badge--warn'}`}>
          {hasToken ? 'Guardado' : 'Sin token'}
        </span>
      </summary>

      <div className="details-body">
        <p className="details-text">
          Los endpoints de administración exigen el token del backend cuando la app se abre a
          través del túnel. Se guarda en este dispositivo (localStorage) y nunca forma parte del
          bundle de React.
        </p>

        <form
          className="token-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSave(value);
            setValue('');
            setVisible(false);
          }}
        >
          <label className="field">
            <span className="field__label">PUSH_TEST_ADMIN_TOKEN</span>
            <input
              className="field__input"
              type={visible ? 'text' : 'password'}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="Pega el token del backend"
              autoComplete="off"
              spellCheck={false}
            />
          </label>

          <div className="token-actions">
            <button type="submit" className="btn btn--small btn--secondary">
              Guardar
            </button>
            <button
              type="button"
              className="btn btn--small btn--ghost"
              onClick={() => setVisible((current) => !current)}
            >
              {visible ? 'Ocultar' : 'Mostrar'}
            </button>
            {hasToken ? (
              <button
                type="button"
                className="btn btn--small btn--ghost"
                onClick={() => {
                  onSave('');
                  setValue('');
                }}
              >
                Olvidar
              </button>
            ) : null}
          </div>
        </form>

        <p className="details-text details-text--muted">
          Abriendo la app directamente en <code>localhost</code> no se necesita token.
        </p>
      </div>
    </details>
  );
}
