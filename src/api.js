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
  const res = await fetch(`/api/${path}`, {
    ...init,
    headers: { ...(init.headers || {}), 'x-edit-pin': getPin() },
  });
  return res;
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
