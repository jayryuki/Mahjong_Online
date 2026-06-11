import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import { initTheme } from '@games/ui';
import '@games/ui/tokens.css';
import '@games/ui/themes/pastel-glass.css';
import '@games/ui/themes/velvet-soft.css';
import '@games/ui/themes/royal-material.css';
import './index.css';

initTheme();

// Initialize theme style from localStorage
const storedStyle = localStorage.getItem('games-theme-style') || 'pastel-glass';
document.documentElement.setAttribute('data-theme-style', storedStyle);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
