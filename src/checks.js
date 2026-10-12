import { batchesText, stripId } from './Labels.jsx';
import { LIMITS } from './limits.js';

const norm = (s) => String(s ?? '').trim();
const isNum = (v) => /^\d+$/.test(norm(v));

/** Fecha y hora de una impresión del historial: "10/12/26" y "14:32". */
export function fmtStamp(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return {
    d: `${p(d.getMonth() + 1)}/${p(d.getDate())}/${String(d.getFullYear()).slice(-2)}`,
    h: `${p(d.getHours())}:${p(d.getMinutes())}`,
  };
}

/** ¿Ese ID ya se usó? clash: en OTRA fórmula/batch (error). again: mismo batch ya impreso antes (aviso). */
export function findIdUse(history, data) {
  const id = stripId(data.identifier);
  if (!id) return {};
  const f = norm(data.formula).toLowerCase();
  const b = norm(data.batch);
  const same = history.filter((h) => stripId(h.identifier) === id);
  const clash = same.find((h) => norm(h.formula).toLowerCase() !== f || norm(h.batch) !== b);
  const again = clash ? undefined : same.find((h) => norm(h.formula).toLowerCase() === f && norm(h.batch) === b);
  return { clash, again };
}

const overList = (text, { lines, chars }) => {
  const rows = String(text ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  return rows.length > lines || rows.some((l) => l.length > chars);
};

/**
 * Revisión previa a imprimir. level 'error': casi seguro es un error; 'warn': conviene mirarlo.
 * Solo si hay algo aquí se pide confirmación al imprimir.
 */
export function collectChecks({ data, job, history, t }) {
  const out = [];
  const eff = { ...data, batches: batchesText(data) };

  const required = { formula: 'Formula', name: 'Name', batch: 'Batch#', po: 'P.O.#', batches: 'Batches', identifier: 'ID' };
  const empty = Object.entries(required).filter(([k]) => !norm(eff[k])).map(([, l]) => l);
  if (job.withMissing && !norm(data.missing)) empty.push(t('empty.missing'));
  if (job.withRefer && !norm(data.refer)) empty.push(t('empty.refer'));
  if (empty.length) out.push({ level: 'error', text: t('chk.empty', { list: empty.join(', ') }) });

  if (!data.batchesCustom && isNum(data.batch) && isNum(data.batchTotal) && parseInt(data.batch, 10) > parseInt(data.batchTotal, 10)) {
    out.push({ level: 'error', text: t('chk.over', { b: data.batch, t: data.batchTotal }) });
  }

  const { clash, again } = findIdUse(history, data);
  if (clash) {
    const { d } = fmtStamp(clash.ts);
    out.push({ level: 'error', text: t('id.clash', { id: `ID-${stripId(data.identifier)}`, f: clash.formula, b: clash.batch || '—', d }) });
  } else if (again) {
    out.push({ level: 'warn', text: t('id.again', { d: fmtStamp(again.ts).d }) });
  }

  const id = stripId(data.identifier);
  if (id && id.length !== 6) out.push({ level: 'warn', text: t('chk.idLen', { n: id.length }) });
  if (norm(data.formula) && !/^\d{6}$/.test(norm(data.formula))) out.push({ level: 'warn', text: t('chk.formulaFmt') });

  if (job.withMissing && overList(data.missing, LIMITS.missing)) out.push({ level: 'warn', text: t('chk.limit', { what: t('sec.missing') }) });
  if (job.withRefer && overList(data.refer, LIMITS.refer)) out.push({ level: 'warn', text: t('chk.limit', { what: t('sec.refer') }) });
  if (data.name.length > LIMITS.name) out.push({ level: 'warn', text: t('chk.limit', { what: 'Name' }) });
  if (data.po.length > LIMITS.po) out.push({ level: 'warn', text: t('chk.limit', { what: 'P.O.#' }) });
  return out;
}
