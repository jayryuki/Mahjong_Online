import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import { initTheme } from '@games/ui';
import '@games/ui/tokens.css';
import './index.css';

initTheme();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
