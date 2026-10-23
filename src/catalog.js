import { useEffect, useState } from 'react';
import { fetchAllItems } from './api.js';

let cache = null; // Promise<[{ part, description }]>
const listeners = new Set();

/** Catálogo de partes en memoria (se pide una sola vez; resetCatalog() lo vuelve a pedir). */
export const loadCatalog = () => (cache ||= fetchAllItems().catch(() => { cache = null; return []; }));
export const resetCatalog = () => { cache = null; listeners.forEach((f) => f()); };

export function useCatalog() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    let alive = true;
    const pull = () => loadCatalog().then((l) => alive && setItems(l));
    pull();
    listeners.add(pull);
    return () => { alive = false; listeners.delete(pull); };
  }, []);
  return items;
}

/** Sugerencias: número que empieza igual primero, luego palabras de la descripción. */
export function searchParts(items, q, max = 8) {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  const words = s.split(/\s+/);
  const byPart = []; const byDesc = [];
  for (const i of items) {
    const p = i.part.toLowerCase();
    if (p.startsWith(s)) byPart.push(i);
    else if (words.every((w) => p.includes(w) || i.description.toLowerCase().includes(w))) byDesc.push(i);
    if (byPart.length >= max) break;
  }
  const isBase = (i) => /^\d{6}$/.test(i.part);
  const base = (l) => [...l.filter(isBase), ...l.filter((i) => !isBase(i))]; // las variantes (700033 A) van después de la parte base
  return [...base(byPart), ...base(byDesc)].slice(0, max);
}
