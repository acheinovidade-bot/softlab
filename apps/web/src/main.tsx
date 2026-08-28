import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Elemento raiz não encontrado');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator) {
  void navigator.serviceWorker.register('/sw.js');
  navigator.serviceWorker.addEventListener('message', (event: MessageEvent<unknown>) => {
    if (
      typeof event.data === 'object' &&
      event.data !== null &&
      'type' in event.data &&
      event.data.type === 'pos-sync-request'
    )
      window.dispatchEvent(new Event('erp:network-restored'));
  });
}
