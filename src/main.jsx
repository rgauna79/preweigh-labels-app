import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import IngredientLabels from './IngredientLabels.jsx';
import { LangProvider } from './i18n.js';
import './index.css';

const MODE_KEY = 'lm.mode';

function Shell() {
  const [mode, setMode] = useState(() => {
    try { return localStorage.getItem(MODE_KEY) === 'ing' ? 'ing' : 'tags'; } catch { return 'tags'; }
  });
  const go = (m) => {
    setMode(m);
    try { localStorage.setItem(MODE_KEY, m); } catch { /* sin almacenamiento */ }
  };
  return mode === 'ing' ? <IngredientLabels onBack={() => go('tags')} /> : <App onOpenIngredients={() => go('ing')} />;
}

createRoot(document.getElementById('root')).render(
  <LangProvider>
    <Shell />
  </LangProvider>
);
