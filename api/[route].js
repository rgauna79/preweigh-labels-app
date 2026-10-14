// API de Label Master para Vercel: /api/formulas, /api/logo, /api/history y /api/auth.
// Los datos viven en Upstash Redis (Vercel → Storage → Upstash Redis → conectar al proyecto).
//   GET  /api/formulas  -> [{ formula, name, ile }]
//   POST /api/formulas  -> { op: 'add' | 'upsert' | 'delete' | 'replace', items: [...] }
//   GET  /api/logo      -> { dataUrl }  (404 si no hay)   PUT -> { dataUrl }   DELETE
//   GET  /api/history   -> últimas impresiones           POST -> { entry }
//   GET  /api/items?part=X | /api/boms?formula=X   catálogo de ingredientes y lista de ingredientes por fórmula (etiquetas)
//   GET  /api/auth      -> { pinRequired }                POST valida el PIN
// Si existe la variable EDIT_PIN, todo cambio (salvo "add" y registrar historial) exige el header x-edit-pin.
// El servidor valida largos y cantidades: los límites del navegador no son suficientes por sí solos.

const REDIS_URL = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const FORMULAS_KEY = 'lm:f'; // hash: una entrada por fórmula (los guardados simultáneos no se pisan)
const LEGACY_KEY = 'lm:formulas'; // versión anterior: un solo bloque JSON (se migra sola)
const HISTORY_KEY = 'lm:history';
const HISTORY_MAX = 500;
const HISTORY_SHOWN = 200;
const MAX_FORMULAS = 5000;
const MAX_ITEMS_PER_REQUEST = 5000;
const MAX_LOGO = 1.5 * 1024 * 1024; // caracteres del dataURL

const ITEMS_KEY = 'lm:i'; // hash: part number -> { part, description }  (catálogo de ingredientes)
const BOMS_KEY = 'lm:b'; // hash: fórmula -> { formula, rows: [{ seq, part, desc }] }  (etiquetas de ingredientes)
const MAX_ITEMS = 30000;
const MAX_ROWS = 80;
const IL = { part: 30, desc: 80 };

const LEN = { formula: 20, name: 80, ile: 10 };
const HLEN = { formula: 20, name: 80, batch: 10, batchTotal: 5, batches: 30, po: 130, date: 10, ile: 10, identifier: 12, missing: 600, refer: 700, by: 40 };

class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function redisCall(path, body) {
  const url = REDIS_URL();
  const token = REDIS_TOKEN();
  if (!url || !token) throw new ApiError(500, 'no_db', 'Database (Upstash Redis) is not connected to the project');
  const res = await fetch(`${url}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok || json.error) throw new ApiError(500, 'db_error', json.error || 'Database error');
  return json;
}
const redis = async (...cmd) => (await redisCall('', cmd)).result;
// Varios comandos como una sola transacción
const redisTx = async (cmds) => (await redisCall('/multi-exec', cmds)).map((r) => r.result);

const text = (v) => String(v ?? '').trim();

function cleanFormula(f) {
  const out = { formula: text(f?.formula), name: text(f?.name), ile: text(f?.ile) };
  if (!out.formula) return null;
  for (const k of Object.keys(LEN)) if (out[k].length > LEN[k]) throw new ApiError(400, 'too_long', `${k} is too long (max ${LEN[k]})`);
  return out;
}

async function readFormulas() {
  let flat = await redis('HGETALL', FORMULAS_KEY);
  if (!flat?.length) {
    // Migración única desde el formato anterior
    const old = await redis('GET', LEGACY_KEY);
    if (old) {
      const list = JSON.parse(old).map((f) => cleanFormulaSafe(f)).filter(Boolean);
      if (list.length) {
        const pairs = list.flatMap((f) => [f.formula.toLowerCase(), JSON.stringify(f)]);
        await redisTx([['HSET', FORMULAS_KEY, ...pairs], ['DEL', LEGACY_KEY]]);
        flat = pairs;
      }
    }
  }
  const out = [];
  for (let i = 1; i < (flat?.length || 0); i += 2) {
    try { out.push(JSON.parse(flat[i])); } catch { /* entrada dañada: se ignora */ }
  }
  return out.sort((a, b) => a.formula.localeCompare(b.formula, undefined, { numeric: true }));
}
const cleanFormulaSafe = (f) => {
  try { return cleanFormula(f); } catch { return null; }
};

function cleanItem(i) {
  const out = { part: text(i?.part), description: text(i?.description) };
  if (!out.part) return null;
  if (out.part.length > IL.part) throw new ApiError(400, 'too_long', `part is too long (max ${IL.part})`);
  if (out.description.length > IL.desc) throw new ApiError(400, 'too_long', `description is too long (max ${IL.desc})`);
  return out;
}

function cleanBom(b) {
  const formula = text(b?.formula);
  if (!formula) throw new ApiError(400, 'bad_op', 'formula is required');
  if (formula.length > LEN.formula) throw new ApiError(400, 'too_long', `formula is too long (max ${LEN.formula})`);
  const raw = Array.isArray(b?.rows) ? b.rows : [];
  if (raw.length > MAX_ROWS) throw new ApiError(400, 'too_many', `Too many ingredients (max ${MAX_ROWS})`);
  const seen = new Set();
  const rows = [];
  for (const r of raw) {
    const row = { seq: parseInt(r?.seq, 10), part: text(r?.part), desc: text(r?.desc) };
    if (!row.part && !row.desc) continue;
    if (!Number.isInteger(row.seq) || row.seq < 1 || row.seq > 99999) throw new ApiError(400, 'bad_seq', 'Seq # must be a whole number');
    if (seen.has(row.seq)) throw new ApiError(400, 'dup_seq', `Seq # ${row.seq} is repeated`);
    seen.add(row.seq);
    for (const k of Object.keys(IL)) if (row[k].length > IL[k]) throw new ApiError(400, 'too_long', `${k} is too long (max ${IL[k]})`);
    rows.push(row);
  }
  return { formula, rows: rows.sort((a, c) => a.seq - c.seq) };
}

function cleanHistory(e) {
  const out = {};
  for (const k of Object.keys(HLEN)) {
    out[k] = text(e?.[k]);
    if (out[k].length > HLEN[k]) throw new ApiError(400, 'too_long', `${k} is too long (max ${HLEN[k]})`);
  }
  if (!out.formula) throw new ApiError(400, 'bad_op', 'formula is required');
  out.pallets = Math.min(6, Math.max(1, parseInt(e?.pallets, 10) || 1));
  out.withMissing = Boolean(e?.withMissing);
  out.withRefer = Boolean(e?.withRefer);
  out.ts = Date.now();
  return out;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const send = (status, data) => res.status(status).json(data);
  const fail = (status, code, error) => send(status, { code, error });
  const body = () => (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {});

  try {
    const route = req.query.route;
    const pin = process.env.EDIT_PIN;
    const pinOk = !pin || req.headers['x-edit-pin'] === pin;
    const denied = () => fail(401, 'pin', 'Wrong or missing PIN');

    if (route === 'auth') {
      if (req.method === 'POST') return pinOk ? send(200, { ok: true }) : denied();
      return send(200, { pinRequired: Boolean(pin) });
    }

    if (route === 'formulas') {
      if (req.method === 'GET') return send(200, await readFormulas());
      if (req.method !== 'POST') return fail(405, 'method', 'Method not allowed');

      const b = body();
      const raw = Array.isArray(b.items) ? b.items : [];
      if (raw.length > MAX_ITEMS_PER_REQUEST) throw new ApiError(400, 'too_many', 'Too many items in one request');
      const items = raw.map(cleanFormula).filter(Boolean);
      const field = (f) => f.formula.toLowerCase();
      const pairs = (list) => list.flatMap((f) => [field(f), JSON.stringify(f)]);

      if (b.op === 'add' || b.op === 'upsert' || b.op === 'replace') {
        if (b.op !== 'add' && !pinOk) return denied();
        if (b.op === 'replace' && items.length > MAX_FORMULAS) throw new ApiError(400, 'too_many', 'Too many formulas');
        if (b.op !== 'replace') {
          const current = await readFormulas(); // también migra el formato anterior si hace falta
          const known = new Set(current.map(field));
          if (current.length + items.filter((f) => !known.has(field(f))).length > MAX_FORMULAS) throw new ApiError(400, 'too_many', 'Too many formulas');
        }
      }
      switch (b.op) {
        case 'add': // agregar una fórmula nueva nunca requiere PIN; si ya existe no se toca
          if (items.length) await redisTx(items.map((f) => ['HSETNX', FORMULAS_KEY, field(f), JSON.stringify(f)]));
          break;
        case 'upsert':
          if (items.length) await redis('HSET', FORMULAS_KEY, ...pairs(items));
          break;
        case 'delete':
          if (!pinOk) return denied();
          await readFormulas(); // migra antes de borrar
          if (items.length) await redis('HDEL', FORMULAS_KEY, ...items.map(field));
          break;
        case 'replace':
          await redisTx([['DEL', FORMULAS_KEY], ['DEL', LEGACY_KEY], ...(items.length ? [['HSET', FORMULAS_KEY, ...pairs(items)]] : [])]);
          break;
        default:
          return fail(400, 'bad_op', 'Unknown operation');
      }
      return send(200, await readFormulas());
    }

    // Catálogo de ingredientes: GET ?part=X -> un ingrediente (404 si no existe) · GET -> { count } · POST { op, items }
    if (route === 'items') {
      if (req.method === 'GET') {
        const part = text(req.query.part);
        if (!part) return send(200, { count: await redis('HLEN', ITEMS_KEY) });
        const raw = await redis('HGET', ITEMS_KEY, part.toLowerCase());
        return raw ? send(200, JSON.parse(raw)) : fail(404, 'not_found', 'Not found');
      }
      if (req.method !== 'POST') return fail(405, 'method', 'Method not allowed');
      const b = body();
      const raw = Array.isArray(b.items) ? b.items : [];
      if (raw.length > MAX_ITEMS_PER_REQUEST) throw new ApiError(400, 'too_many', 'Too many items in one request');
      const items = raw.map(cleanItem).filter(Boolean);
      const field = (i) => i.part.toLowerCase();
      if (b.op === 'add') { // agregar uno nuevo nunca requiere PIN; si ya existe no se toca
        if (items.length && (await redis('HLEN', ITEMS_KEY)) + items.length > MAX_ITEMS) throw new ApiError(400, 'too_many', 'Too many items');
        if (items.length) await redisTx(items.map((i) => ['HSETNX', ITEMS_KEY, field(i), JSON.stringify(i)]));
        return send(200, { count: await redis('HLEN', ITEMS_KEY) });
      }
      if (!pinOk) return denied();
      if (b.op === 'upsert') {
        if (items.length) await redis('HSET', ITEMS_KEY, ...items.flatMap((i) => [field(i), JSON.stringify(i)]));
      } else if (b.op === 'delete') {
        if (items.length) await redis('HDEL', ITEMS_KEY, ...items.map(field));
      } else {
        return fail(400, 'bad_op', 'Unknown operation');
      }
      return send(200, { count: await redis('HLEN', ITEMS_KEY) });
    }

    // Etiquetas de ingredientes por fórmula: GET ?formula=X -> { formula, rows } · GET -> [{ formula, count }]
    // POST { op: 'add' | 'upsert' | 'delete', item: { formula, rows } }
    if (route === 'boms') {
      if (req.method === 'GET') {
        const formula = text(req.query.formula);
        if (formula) {
          const raw = await redis('HGET', BOMS_KEY, formula.toLowerCase());
          return raw ? send(200, JSON.parse(raw)) : fail(404, 'not_found', 'Not found');
        }
        const flat = (await redis('HGETALL', BOMS_KEY)) || [];
        const out = [];
        for (let i = 1; i < flat.length; i += 2) {
          try { const v = JSON.parse(flat[i]); out.push({ formula: v.formula, count: v.rows.length }); } catch { /* entrada dañada */ }
        }
        return send(200, out);
      }
      if (req.method !== 'POST') return fail(405, 'method', 'Method not allowed');
      const b = body();
      if (b.op === 'delete') {
        if (!pinOk) return denied();
        await redis('HDEL', BOMS_KEY, text(b.item?.formula).toLowerCase());
        return send(200, { ok: true });
      }
      if (b.op !== 'add' && b.op !== 'upsert') return fail(400, 'bad_op', 'Unknown operation');
      const bom = cleanBom(b.item);
      const key = bom.formula.toLowerCase();
      // Cada ingrediente nuevo entra solo al catálogo (los que ya existen no se tocan)
      const learn = bom.rows.filter((r) => r.part && r.desc).map((r) => ['HSETNX', ITEMS_KEY, r.part.toLowerCase(), JSON.stringify({ part: r.part, description: r.desc })]);
      if (b.op === 'add') { // una fórmula nueva no requiere PIN; si ya tiene lista no se toca
        if ((await redis('HEXISTS', BOMS_KEY, key)) === 1) return fail(409, 'exists', 'This formula already has a list');
        await redisTx([['HSETNX', BOMS_KEY, key, JSON.stringify(bom)], ...learn]);
      } else {
        if (!pinOk) return denied();
        await redisTx([['HSET', BOMS_KEY, key, JSON.stringify(bom)], ...learn]);
      }
      return send(200, bom);
    }

    if (route === 'history') {
      if (req.method === 'GET') {
        const rows = (await redis('LRANGE', HISTORY_KEY, 0, HISTORY_SHOWN - 1)) || [];
        return send(200, rows.map((r) => { try { return JSON.parse(r); } catch { return null; } }).filter(Boolean));
      }
      if (req.method === 'POST') {
        const entry = cleanHistory(body().entry);
        await redisTx([['LPUSH', HISTORY_KEY, JSON.stringify(entry)], ['LTRIM', HISTORY_KEY, 0, HISTORY_MAX - 1]]);
        return send(200, { ok: true });
      }
      return fail(405, 'method', 'Method not allowed');
    }

    if (route === 'logo') {
      if (req.method === 'GET') {
        const dataUrl = await redis('GET', 'lm:logo');
        return dataUrl ? send(200, { dataUrl }) : fail(404, 'not_found', 'No logo');
      }
      if (!pinOk) return denied();
      if (req.method === 'DELETE') {
        await redis('DEL', 'lm:logo');
        return send(200, { ok: true });
      }
      if (req.method === 'PUT') {
        const dataUrl = String(body().dataUrl || '');
        if (!/^data:image\/(png|jpeg|webp|gif);base64,/.test(dataUrl)) return fail(400, 'not_image', 'The logo must be an image');
        if (dataUrl.length > MAX_LOGO) return fail(413, 'too_big', 'Image too large');
        await redis('SET', 'lm:logo', dataUrl);
        return send(200, { ok: true });
      }
    }

    return fail(404, 'not_found', 'Not found');
  } catch (err) {
    if (err instanceof ApiError) return send(err.status, { code: err.code, error: err.message });
    return send(500, { code: 'server', error: err.message || 'Server error' });
  }
}
