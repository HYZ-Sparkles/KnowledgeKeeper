import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { createCore } from './core';
import { indexedDbAdapter } from './core/indexeddb-adapter';
import { registerServiceWorker } from './pwa';
import './index.css';

// Composition root: dependencies are injected here, never created in the core.
const core = createCore({
  storage: indexedDbAdapter(),
  clock: { now: () => new Date() },
  random: { next: () => Math.random() },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App core={core} />
  </React.StrictMode>,
);

registerServiceWorker();
