import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register PWA Service Worker for offline media playback and asset caching
if ('serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onRegistered(registration) {
      console.log('Service Worker do Mídia Indoor registrado com sucesso para reprodução offline.');
      if (registration) {
        // Periodic check for cache updates every hour
        setInterval(() => {
          registration.update().catch(() => {});
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.warn('Erro ao registrar Service Worker:', error);
    },
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

