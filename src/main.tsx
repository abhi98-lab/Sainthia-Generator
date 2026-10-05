import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register service worker for offline shell support and PWA compliance
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Relative registration path for compatibility with subpath and root deployments
    const swPath = import.meta.env.BASE_URL ? `${import.meta.env.BASE_URL}sw.js` : './sw.js';
    navigator.serviceWorker
      .register(swPath)
      .catch((err) => {
        console.warn('Service worker registration failed:', err);
      });
  });
}

createRoot(document.getElementById('root')!).render(<App />);
