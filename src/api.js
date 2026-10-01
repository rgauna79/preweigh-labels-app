// Cliente de la API compartida (netlify/functions/api.mjs).
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
    const pin = window.prompt('Se requiere el PIN de edición:');
    if (pin === null) throw new Error('Cancelado');
    setPin(pin.trim());
    res = await run();
    if (res.status === 401) {
      setPin('');
      throw new Error('PIN incorrecto');
    }
  }
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Error del servidor');
  return res;
}

export async function fetchFormulas() {
  const res = await call('formulas', { cache: 'no-store' });
  if (!res.ok) throw new Error('No se pudo leer la lista de fórmulas');
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
  const blob = await res.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

export async function uploadLogo(blob) {
  await withPin(() => call('logo', { method: 'PUT', headers: { 'content-type': blob.type }, body: blob }));
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
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Imagen no válida'))), 'image/png');
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error('Imagen no válida'));
    img.src = URL.createObjectURL(file);
  });
}
