import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import IngredientLabels from './IngredientLabels.jsx';
import { LangProvider } from './i18n.js';
import './index.css';

const MODE_KEY = 'lm.mode';
const LABELS_KEY = 'lm.labels'; // este navegador/PC tiene impresora de etiquetas (muestra el módulo 4×2)

// El acceso directo del navegador puede abrir la app con ?labels=1 (activa) o ?labels=0 (desactiva)
const readLabels = () => {
  try {
    const q = new URLSearchParams(window.location.search).get('labels');
    if (q === '1' || q === '0') localStorage.setItem(LABELS_KEY, q);
    return localStorage.getItem(LABELS_KEY) === '1';
  } catch { return false; }
};

function Shell() {
  const [labels, setLabelsState] = useState(readLabels);
  const [mode, setMode] = useState(() => {
    try { return labels && localStorage.getItem(MODE_KEY) === 'ing' ? 'ing' : 'tags'; } catch { return 'tags'; }
  });
  const setLabels = (on) => {
    setLabelsState(on);
    if (!on) setMode('tags');
    try { localStorage.setItem(LABELS_KEY, on ? '1' : '0'); } catch { /* sin almacenamiento */ }
  };
  const go = (m) => {
    setMode(m);
    try { localStorage.setItem(MODE_KEY, m); } catch { /* sin almacenamiento */ }
  };
  return mode === 'ing' && labels
    ? <IngredientLabels onBack={() => go('tags')} />
    : <App onOpenIngredients={labels ? () => go('ing') : null} labelsEnabled={labels} onLabelsEnabled={setLabels} />;
}

createRoot(document.getElementById('root')).render(
  <LangProvider>
    <Shell />
  </LangProvider>
);
