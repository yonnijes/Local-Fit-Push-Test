import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './index.css';

registerSW({
  immediate: true,
  onRegisterError(error) {
    console.error('No se pudo registrar el Service Worker:', error);
  },
});

const container = document.getElementById('root');
if (!container) throw new Error('No se encontró el contenedor #root');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
