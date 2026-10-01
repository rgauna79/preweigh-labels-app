// API mínima de Label Master para Vercel: /api/formulas, /api/logo y /api/auth.
// Los datos se guardan en Upstash Redis (Vercel → Storage → Upstash Redis → conectar al proyecto).
//   GET  /api/formulas  -> [{ formula, name, ile }]
//   POST /api/formulas  -> { op: 'add' | 'upsert' | 'delete' | 'replace', items: [...] }
//   GET  /api/logo      -> { dataUrl }  (404 si no hay)   PUT -> { dataUrl }   DELETE
//   GET  /api/auth      -> { pinRequired }                POST valida el PIN
// Si existe la variable EDIT_PIN, todo cambio (salvo "add") exige el header x-edit-pin.

const REDIS_URL = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(...cmd) {
  const url = REDIS_URL();
  const token = REDIS_TOKEN();
  if (!url || !token) throw new Error('Falta conectar la base de datos (Upstash Redis) al proyecto');
  const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(cmd) });
  const body = await res.json();
  if (!res.ok || body.error) throw new Error(body.error || 'Error de la base de datos');
  return body.result;
}

const clean = (f) => ({
  formula: String(f?.formula ?? '').trim(),
  name: String(f?.name ?? '').trim(),
  ile: String(f?.ile ?? '').trim(),
});
const key = (f) => f.formula.toLowerCase();
const MAX_LOGO = 1.5 * 1024 * 1024; // caracteres del dataURL

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const send = (status, data) => res.status(status).json(data);

  try {
    const route = req.query.route;
    const pin = process.env.EDIT_PIN;
    const pinOk = !pin || req.headers['x-edit-pin'] === pin;
    const denied = () => send(401, { error: 'PIN incorrecto o requerido' });

    if (route === 'auth') {
      if (req.method === 'POST') return pinOk ? send(200, { ok: true }) : denied();
      return send(200, { pinRequired: Boolean(pin) });
    }

    if (route === 'formulas') {
      const list = JSON.parse((await redis('GET', 'lm:formulas')) || '[]');
      if (req.method === 'GET') return send(200, list);
      if (req.method !== 'POST') return send(405, { error: 'Método no permitido' });

      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
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
          return send(400, { error: 'Operación desconocida' });
      }
      const next = [...map.values()];
      await redis('SET', 'lm:formulas', JSON.stringify(next));
      return send(200, next);
    }

    if (route === 'logo') {
      if (req.method === 'GET') {
        const dataUrl = await redis('GET', 'lm:logo');
        return dataUrl ? send(200, { dataUrl }) : send(404, { error: 'No hay logo' });
      }
      if (!pinOk) return denied();
      if (req.method === 'DELETE') {
        await redis('DEL', 'lm:logo');
        return send(200, { ok: true });
      }
      if (req.method === 'PUT') {
        const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
        const dataUrl = String(body.dataUrl || '');
        if (!/^data:image\/(png|jpeg|webp|gif);base64,/.test(dataUrl)) return send(400, { error: 'El logo debe ser una imagen' });
        if (dataUrl.length > MAX_LOGO) return send(413, { error: 'Imagen demasiado grande' });
        await redis('SET', 'lm:logo', dataUrl);
        return send(200, { ok: true });
      }
    }

    return send(404, { error: 'No encontrado' });
  } catch (err) {
    return send(500, { error: err.message || 'Error del servidor' });
  }
}
