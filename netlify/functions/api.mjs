// API mínima: guarda la lista de fórmulas y el logo en Netlify Blobs.
//   GET  /api/formulas            -> [{ formula, name, ile }]
//   POST /api/formulas            -> { op: 'add' | 'upsert' | 'delete' | 'replace', ... }
//   GET  /api/logo                -> imagen (404 si no hay)
//   PUT  /api/logo                -> sube/reemplaza el logo (cuerpo = imagen)
//   DELETE /api/logo              -> quita el logo
//   GET  /api/auth                -> { pinRequired } ; POST /api/auth con x-edit-pin valida el PIN
// Si existe la variable de entorno EDIT_PIN, todo cambio (salvo "add") exige el header x-edit-pin.
import { getStore } from '@netlify/blobs';

export const config = { path: '/api/*' };

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

const clean = (f) => ({
  formula: String(f?.formula ?? '').trim(),
  name: String(f?.name ?? '').trim(),
  ile: String(f?.ile ?? '').trim(),
});
const key = (f) => f.formula.toLowerCase();
const MAX_LOGO = 2 * 1024 * 1024;

export default async (req) => {
  const store = getStore('labels');
  const route = new URL(req.url).pathname.replace(/^\/api\//, '').replace(/\/$/, '');
  const pin = Netlify.env.get('EDIT_PIN');
  const pinOk = !pin || req.headers.get('x-edit-pin') === pin;
  const denied = () => json({ error: 'PIN incorrecto o requerido' }, 401);

  if (route === 'auth') {
    return req.method === 'POST' ? (pinOk ? json({ ok: true }) : denied()) : json({ pinRequired: Boolean(pin) });
  }

  if (route === 'formulas') {
    const list = (await store.get('formulas', { type: 'json' })) || [];
    if (req.method === 'GET') return json(list);
    if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

    let body;
    try { body = await req.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
    const items = (Array.isArray(body.items) ? body.items : []).map(clean).filter((f) => f.formula);
    const map = new Map(list.map((f) => [key(f), f]));

    switch (body.op) {
      case 'add': // agregar una fórmula nueva nunca requiere PIN; si ya existe no se toca
        items.forEach((f) => { if (!map.has(key(f))) map.set(key(f), f); });
        break;
      case 'upsert':
        if (!pinOk) return denied();
        items.forEach((f) => map.set(key(f), f));
        break;
      case 'delete':
        if (!pinOk) return denied();
        items.forEach((f) => map.delete(key(f)));
        break;
      case 'replace':
        if (!pinOk) return denied();
        map.clear();
        items.forEach((f) => map.set(key(f), f));
        break;
      default:
        return json({ error: 'Operación desconocida' }, 400);
    }
    const next = [...map.values()];
    await store.setJSON('formulas', next);
    return json(next);
  }

  if (route === 'logo') {
    if (req.method === 'GET') {
      const res = await store.getWithMetadata('logo', { type: 'arrayBuffer' });
      if (!res) return new Response('No hay logo', { status: 404 });
      return new Response(res.data, {
        headers: { 'content-type': res.metadata?.type || 'image/png', 'cache-control': 'no-cache' },
      });
    }
    if (!pinOk) return denied();
    if (req.method === 'DELETE') {
      await store.delete('logo');
      return json({ ok: true });
    }
    if (req.method === 'PUT') {
      const type = req.headers.get('content-type') || '';
      if (!type.startsWith('image/')) return json({ error: 'El logo debe ser una imagen' }, 400);
      const buf = await req.arrayBuffer();
      if (buf.byteLength > MAX_LOGO) return json({ error: 'Imagen demasiado grande (máx. 2 MB)' }, 413);
      await store.set('logo', buf, { metadata: { type } });
      return json({ ok: true });
    }
  }

  return json({ error: 'No encontrado' }, 404);
};
