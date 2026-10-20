// Cliente de la API compartida (api/[route].js).
import { tr } from './i18n.js';
const PIN_KEY = 'lm.pin';

const getPin = () => {
  try { return localStorage.getItem(PIN_KEY) || ''; } catch { return ''; }
};
const setPin = (v) => {
  try { v ? localStorage.setItem(PIN_KEY, v) : localStorage.removeItem(PIN_KEY); } catch { /* sin almacenamiento */ }
};

async function call(path, init = {}) {
  try {
    return await fetch(`/api/${path}`, {
      ...init,
      headers: { ...(init.headers || {}), 'x-edit-pin': getPin() },
    });
  } catch {
    throw new Error(tr('err.network')); // sin internet o servidor caído
  }
}

/** Ejecuta una operación protegida; si el servidor pide PIN, lo pregunta y reintenta una vez. */
async function withPin(run) {
  let res = await run();
  if (res.status === 401) {
    const pin = window.prompt(tr('pin.prompt'));
    if (pin === null) throw new Error(tr('err.cancelled'));
    setPin(pin.trim());
    res = await run();
    if (res.status === 401) {
      setPin('');
      throw new Error(tr('err.pin'));
    }
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.code ? tr(`err.${body.code}`) : body.error || tr('err.server'));
  }
  return res;
}

export async function fetchFormulas() {
  const res = await call('formulas', { cache: 'no-store' });
  if (!res.ok) throw new Error(tr('err.readList'));
  return res.json();
}

/** op: 'add' (abierta) | 'upsert' | 'delete' | 'replace' (con PIN si está configurado). */
export async function writeFormulas(op, items) {
  const res = await withPin(() =>
    call('formulas', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op, items }) })
  );
  return res.json();
}

export async function fetchLogo() {
  const res = await call('logo', { cache: 'no-store' });
  if (!res.ok) return null;
  return (await res.json()).dataUrl || null;
}

const toDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

export async function uploadLogo(blob) {
  const dataUrl = await toDataUrl(blob);
  await withPin(() =>
    call('logo', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dataUrl }) })
  );
}

export async function deleteLogo() {
  await withPin(() => call('logo', { method: 'DELETE' }));
}

/** Reduce el logo a un PNG de ancho máximo 600 px antes de subirlo. */
export function shrinkImage(file, maxW = 600) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, maxW / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * k);
      canvas.height = Math.round(img.height * k);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error(tr('err.image')))), 'image/png');
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error(tr('err.image')));
    img.src = URL.createObjectURL(file);
  });
}

/** Últimas impresiones de todos los usuarios (más recientes primero). */
export async function fetchHistory() {
  const res = await call('history', { cache: 'no-store' });
  if (!res.ok) throw new Error(tr('err.server'));
  return res.json();
}

/** Registra una impresión. No pide PIN. Si falla no debe impedir imprimir, por eso el que llama lo ignora. */
export async function addHistory(entry) {
  const res = await call('history', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ entry }) });
  if (!res.ok) throw new Error(tr('err.server'));
}

/** Lista de ingredientes guardada para una fórmula ({ formula, rows: [{ seq, part, desc }] }) o null si no tiene. */
export async function fetchBom(formula) {
  const res = await call(`boms?formula=${encodeURIComponent(formula)}`, { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(tr('err.server'));
  return res.json();
}

/** Fórmulas que ya tienen lista de ingredientes: [{ formula, count }]. */
export async function fetchBomIndex() {
  const res = await call('boms', { cache: 'no-store' });
  if (!res.ok) throw new Error(tr('err.server'));
  return res.json();
}

/** op: 'add' (abierta, solo fórmulas sin lista) | 'upsert' | 'delete' (con PIN si está configurado). */
export async function writeBom(op, item) {
  const res = await withPin(() =>
    call('boms', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op, item }) })
  );
  return res.json();
}

/** Busca un número de parte en el catálogo; null si no existe. */
export async function fetchItem(part) {
  const res = await call(`items?part=${encodeURIComponent(part)}`, { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(tr('err.server'));
  return res.json();
}

/** Importación masiva del catálogo (con PIN si está configurado). items: [{ part, description }] */
export async function writeItems(op, items) {
  const res = await withPin(() =>
    call('items', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op, items }) })
  );
  return res.json();
}

/** Catálogo completo: [{ part, description }] */
export async function fetchAllItems() {
  const res = await call('items?all=1', { cache: 'no-store' });
  if (!res.ok) throw new Error(tr('err.server'));
  return (await res.json()).items || [];
}
