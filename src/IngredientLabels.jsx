import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, Check, ClipboardPaste, HelpCircle, Plus, Printer, Save, Trash2, X } from 'lucide-react';
import { useLang } from './i18n.js';
import Toast from './Toast.jsx';
import Suggest from './Suggest.jsx';
import { confirmDialog } from './dialogs.jsx';
import OfflineBanner from './OfflineBanner.jsx';
import WelcomeGuide from './WelcomeGuide.jsx';
import { searchParts, useCatalog } from './catalog.js';
import IngredientLabel, { checkLabel } from './IngredientLabel.jsx';
import { DIL_X, DIL_Y, DPI, THRESHOLDS, labelBitmap, testBitmap } from './rasterize.js';
import { fetchBom, fetchBomIndex, fetchFormulas, fetchItem, writeBom, writeFormulas } from './api.js';

const inputCls =
  'w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none';

const norm = (s) => String(s ?? '').trim();
const PAGE_STYLE_ID = 'ing-page-style';

const load = (key, fallback) => {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
};
const save = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* sin almacenamiento */ }
};

let uid = 0;
const newRow = (seq = '', part = '', desc = '') => ({ id: ++uid, seq: String(seq), part, desc, lp: part, checked: true });
const nextSeq = (rows) => String((Math.floor(Math.max(0, ...rows.map((r) => parseInt(r.seq, 10) || 0)) / 10) + 1) * 10);

/** Convierte lo pegado desde Excel ("part⇥descripción" por línea) en filas con secuencia 10, 20, 30… */
function parsePaste(text, startSeq = 10) {
  return text
    .split(/\r?\n/)
    .map((l) => l.split('\t').map(norm))
    .filter((c) => c.some(Boolean))
    .map((c, i) => newRow(startSeq + i * 10, c[0] || '', c.slice(1).join(' ')));
}

// Datos de la página de tags (Preweigh): la fórmula y el batch viajan a esta pantalla
const linkedData = () => load('lm.data', {});
const isNum = (v) => /^\d{1,3}$/.test(norm(v));

export default function IngredientLabels({ onBack }) {
  const { lang, setLang, t } = useLang();
  const [formulas, setFormulas] = useState([]);
  const [index, setIndex] = useState([]); // fórmulas que ya tienen lista de ingredientes
  const [linked] = useState(linkedData);
  const [formula, setFormula] = useState(() => norm(linked.formula) || load('lm.ing.formula', ''));
  const [name, setName] = useState('');
  const [rows, setRows] = useState([]);
  const [saved, setSaved] = useState(null); // copia guardada (para saber si hay cambios), null = fórmula sin lista
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(0);
  const [batchFrom, setBatchFrom] = useState(() => (isNum(linked.batch) ? norm(linked.batch) : ''));
  const [batchTo, setBatchTo] = useState(() => (isNum(linked.batch) ? norm(linked.batch) : ''));
  const [showPart, setShowPart] = useState(() => load('lm.ing.showPart', true)); // imprimir el número de parte en Item Code
  const [preparing, setPreparing] = useState(false);
  const [showGuide, setShowGuide] = useState(() => { try { return localStorage.getItem('lm.guideSeen.labels') !== '1'; } catch { return false; } });
  const closeGuide = () => { setShowGuide(false); try { localStorage.setItem('lm.guideSeen.labels', '1'); } catch { /* sin almacenamiento */ } };
  const [seqDraft, setSeqDraft] = useState(null); // texto mientras se escribe; null = se muestra lo marcado
  // "30" o "20, 40-60": marca solo esas secuencias
  const applySeqs = (txt) => {
    setSeqDraft(txt);
    const set = new Set();
    txt.split(/[,;\s]+/).filter(Boolean).forEach((p) => {
      const m = p.match(/^(\d+)(?:-(\d+))?$/);
      if (!m) return;
      const a = +m[1]; const b = m[2] ? +m[2] : a;
      for (let i = Math.min(a, b); i <= Math.max(a, b) && i <= 99999; i++) set.add(i);
    });
    setRows((rs) => rs.map((r) => ({ ...r, checked: set.size ? set.has(parseInt(r.seq, 10)) : true })));
  };
  // Lo marcado, resumido: 10, 20, 40-60 (vacío = todas)
  const seqSummary = (() => {
    if (rows.every((r) => r.checked)) return '';
    const out = []; let run = [];
    const flush = () => { if (run.length > 2) out.push(`${run[0]}-${run[run.length - 1]}`); else out.push(...run); run = []; };
    rows.forEach((r) => { if (r.checked && /^\d+$/.test(r.seq)) run.push(r.seq); else flush(); });
    flush();
    return out.join(', ');
  })();
  const [offset, setOffset] = useState(() => ({ x: 2, y: 1, dark: 0, ...load('lm.ing.offset', {}) })); // calibración en mm
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [toast, setToast] = useState(null);
  const [printJob, setPrintJob] = useState(null); // [{ seq, part, desc }] mientras se imprime
  const toastTimer = useRef(null);

  const flash = (text) => {
    clearTimeout(toastTimer.current);
    setToast({ text });
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  };

  useEffect(() => {
    fetchFormulas().then(setFormulas).catch(() => setStatus(t('err.offline')));
    fetchBomIndex().then(setIndex).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cambiar de fórmula: solo recarga si es otra, y avisa antes de descartar cambios sin guardar
  const switchFormula = async (value) => {
    const f = norm(value);
    setFormula(value);
    if (f === loadedFor.current) return;
    if (dirty && !(await confirmDialog({ title: t('ing.discardTitle'), message: t('ing.discard'), confirmLabel: t('ing.discardBtn'), cancelLabel: t('ing.keepEditing'), tone: 'danger' }))) { setFormula(loadedFor.current ?? ''); return; }
    loadFormula(f);
  };
  const formulaOptions = (() => {
    const q = norm(formula).toLowerCase();
    if (!q) return [];
    return formulas
      .filter((f) => f.formula && (f.formula.toLowerCase().includes(q) || (f.name || '').toLowerCase().includes(q)))
      .sort((a, b) => (b.formula.toLowerCase().startsWith(q) - a.formula.toLowerCase().startsWith(q)) || a.formula.localeCompare(b.formula))
      .slice(0, 8)
      .map((f) => ({ key: f.formula, primary: f.formula, secondary: `${f.name || ''}${index.some((b) => b.formula.toLowerCase() === f.formula.toLowerCase()) ? ' ✓' : ''}` }));
  })();

  const known = useMemo(() => formulas.find((f) => f.formula.toLowerCase() === norm(formula).toLowerCase()), [formulas, formula]);
  const hasList = useMemo(() => index.some((b) => b.formula.toLowerCase() === norm(formula).toLowerCase()), [index, formula]);
  const snapshot = (list) => JSON.stringify(list.map((r) => [parseInt(r.seq, 10) || 0, norm(r.part), norm(r.desc)]));
  const dirty = saved === null ? rows.length > 0 : snapshot(rows) !== saved;

  /** Carga la lista guardada de la fórmula escrita (si existe). */
  const loadedFor = useRef(null); // fórmula cuya lista está en pantalla
  const loadSeq = useRef(0);
  const loadFormula = async (value = formula) => {
    const f = norm(value);
    const mine = ++loadSeq.current;
    loadedFor.current = f;
    save('lm.ing.formula', f);
    if (!f) { setRows([]); setSaved(null); setName(''); setStatus(''); return; }
    setBusy(true);
    setStatus('');
    try {
      const bom = await fetchBom(f);
      if (mine !== loadSeq.current) return; // llegó tarde: ya se pidió otra fórmula
      const list = bom ? bom.rows.map((r) => newRow(r.seq, r.part, r.desc)) : [];
      setRows(list);
      setSaved(bom ? snapshot(list) : null);
      setPreview(0);
      const match = formulas.find((x) => x.formula.toLowerCase() === f.toLowerCase());
      setName(match ? match.name : '');
      setStatus(bom ? '' : t('ing.noList', { f }));
    } catch (e) {
      setStatus(e.message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { if (formula) loadFormula(); }, [formulas.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = (id, p) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const addRow = () => setRows((rs) => [...rs, newRow(rs.length ? nextSeq(rs) : 10)]);
  const removeRow = (id) => setRows((rs) => rs.filter((r) => r.id !== id));

  const catalog = useCatalog();
  const byPart = useMemo(() => new Map(catalog.map((i) => [i.part.toLowerCase(), i])), [catalog]);

  /** Al salir del número de parte o con Enter: si cambió (o la descripción está vacía) se busca en el catálogo y se reemplaza la descripción. */
  const lookupPart = async (row) => {
    const part = norm(row.part);
    if (!part || (part === row.lp && norm(row.desc))) return;
    try {
      const item = byPart.get(part.toLowerCase()) || (catalog.length ? null : await fetchItem(part)); // con el catálogo en memoria no hace falta ir al servidor
      patch(row.id, item?.description ? { desc: item.description, lp: part } : { lp: part });
    } catch { /* sin conexión: se escribe a mano */ }
  };

  const applyPaste = () => {
    const parsed = parsePaste(pasteText, rows.length ? Number(nextSeq(rows)) : 10);
    setRows((rs) => [...rs, ...parsed]);
    setPasteText('');
    setShowPaste(false);
    // Completa las descripciones que faltan con el catálogo
    parsed.filter((r) => r.part && !r.desc).forEach(lookupPart);
  };

  const validate = () => {
    const seqs = rows.filter((r) => norm(r.part) || norm(r.desc)).map((r) => parseInt(r.seq, 10));
    if (seqs.some((s) => !Number.isInteger(s) || s < 1)) return t('ing.badSeq');
    if (new Set(seqs).size !== seqs.length) return t('ing.dupSeq');
    return '';
  };

  const saveList = async () => {
    const f = norm(formula);
    const problem = validate();
    if (problem) { setStatus(problem); return; }
    setBusy(true);
    setStatus('');
    try {
      if (!known && norm(name)) await writeFormulas('add', [{ formula: f, name: norm(name), ile: '' }]);
      const item = { formula: f, rows: rows.map((r) => ({ seq: r.seq, part: norm(r.part), desc: norm(r.desc) })) };
      const out = await writeBom(hasList ? 'upsert' : 'add', item);
      const list = out.rows.map((r) => newRow(r.seq, r.part, r.desc));
      setRows(list);
      setSaved(snapshot(list));
      setIndex(await fetchBomIndex());
      if (!known) setFormulas(await fetchFormulas());
      flash(t('ing.saved'));
    } catch (e) {
      setStatus(e.message);
    } finally {
      setBusy(false);
    }
  };

  // --- Impresión: una página de 4 x 2 in por etiqueta
  const selected = rows.filter((r) => r.checked && (norm(r.part) || norm(r.desc)));
  // Batches a imprimir: de "desde" a "hasta" (si "hasta" está vacío, solo uno). Sin número = sin batch en la etiqueta.
  const batchList = (() => {
    if (!isNum(batchFrom)) return [''];
    const a = parseInt(batchFrom, 10);
    const b = isNum(batchTo) ? parseInt(batchTo, 10) : a;
    const lo = Math.min(a, b);
    const hi = Math.min(Math.max(a, b), lo + 99);
    return Array.from({ length: hi - lo + 1 }, (_, i) => String(lo + i));
  })();
  const total = selected.length * batchList.length; // las copias se eligen en el diálogo de impresión
  const linkedTotal = isNum(linked.batchTotal) ? parseInt(linked.batchTotal, 10) : 0;

  const printDotTest = () => setPrintJob({ images: [testBitmap()] });

  const doPrint = async (list, test = false) => {
    setStatus('');
    if (!test && cuts.length && !(await confirmDialog({ title: t('ing.vTitle'), message: t('ing.vConfirm', { list: cuts.slice(0, 5).map((i) => `• ${i.text}`).join('\n') }), confirmLabel: t('ing.printAnyway'), cancelLabel: t('ing.goFix') }))) return;
    if (!test && total > 60 && !(await confirmDialog({ title: t('ing.manyTitle'), message: t('ing.confirmMany', { n: total }), confirmLabel: t('ing.printN', { n: total }) }))) return;
    setPreparing(true);
    try {
      const mmToDots = (v) => (mm(v) * DPI) / 25.4;
      const opts = { threshold: THRESHOLDS[offset.dark] ?? THRESHOLDS[2], dilY: DIL_Y[offset.dark] ?? 1, dilX: DIL_X[offset.dark] ?? 0, dx: mmToDots(offset.x), dy: mmToDots(offset.y) };
      const jobs = test ? list.map((r) => ({ r, b: '1' })) : batchList.flatMap((b) => list.map((r) => ({ r, b })));
      const images = [];
      for (const { r, b } of jobs) { // de a una: cada bitmap usa un lienzo grande
        images.push(await labelBitmap({ name: test ? 'FORMULA NAME' : title, part: showPart ? r.part : '', seq: r.seq, desc: r.desc, batch: b }, opts));
      }
      setPrintJob({ images });
    } catch (e) {
      setStatus(e.message);
    } finally {
      setPreparing(false);
    }
  };

  useEffect(() => {
    if (!printJob) return undefined;
    // El tamaño de página se fija solo mientras se imprime (la otra pantalla de la app usa hoja Letter)
    const style = document.createElement('style');
    style.id = PAGE_STYLE_ID;
    style.textContent = '@media print { @page { size: 4in 2in; margin: 0; } }';
    document.head.appendChild(style);
    const done = () => { style.remove(); setPrintJob(null); };
    window.addEventListener('afterprint', done, { once: true });
    let cancelled = false;
    // Espera a que todas las imágenes estén decodificadas antes de abrir el diálogo
    requestAnimationFrame(async () => {
      const imgs = Array.from(document.querySelectorAll('.ing-print img'));
      await Promise.all(imgs.map((i) => i.decode().catch(() => {})));
      if (!cancelled) window.print();
    });
    return () => { cancelled = true; window.removeEventListener('afterprint', done); style.remove(); };
  }, [printJob]);

  const setOff = (k, v) => {
    const next = { ...offset, [k]: v };
    setOffset(next);
    save('lm.ing.offset', next);
  };
  const mm = (v) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : 0);

  const title = norm(name) || known?.name || '';
  const shown = rows[preview] || rows[0];

  // --- Validación: nada debe salirse ni imprimirse ilegible
  const worstBatch = batchList.reduce((a, b) => (b.length > a.length ? b : a), '');
  const checks = useMemo(() => rows.map((r) => ({ id: r.id, sn: r.seq, ...checkLabel({ name: title, part: showPart ? r.part : '', seq: r.seq, desc: r.desc, batch: worstBatch }) })), [rows, title, showPart, worstBatch]); // eslint-disable-line react-hooks/exhaustive-deps
  const fieldName = { name: t('ing.fName'), part: t('ing.part'), desc: t('ing.desc'), seq: 'Seq #' };
  const issues = [];
  const nameState = checks.length ? (checks.some((c) => c.name === 'cut') ? 'cut' : checks.some((c) => c.name === 'small') ? 'small' : 'ok') : checkLabel({ name: title, batch: worstBatch }).name;
  if (nameState !== 'ok') issues.push({ level: nameState, text: t(nameState === 'cut' ? 'ing.vCut' : 'ing.vSmall', { field: fieldName.name }) });
  checks.forEach((c) => {
    const r = rows.find((x) => x.id === c.id);
    if (!r || !(norm(r.part) || norm(r.desc))) return;
    ['part', 'desc', 'seq'].forEach((k) => {
      if (c[k] !== 'ok') issues.push({ level: c[k], text: `Seq ${c.sn || '?'} · ${t(c[k] === 'cut' ? 'ing.vCut' : 'ing.vSmall', { field: fieldName[k] })}` });
    });
    if (!norm(r.desc)) issues.push({ level: 'small', text: t('ing.vNoDesc', { s: c.sn || '?' }) });
    else if (showPart && !norm(r.part)) issues.push({ level: 'small', text: t('ing.vNoPart', { s: c.sn || '?' }) });
  });
  if (!norm(title) && rows.length) issues.push({ level: 'small', text: t('ing.vNoName') });
  const lastBatch = parseInt(batchList[batchList.length - 1], 10);
  if (linkedTotal && lastBatch > linkedTotal) issues.push({ level: 'small', text: t('ing.vBatchOver', { b: lastBatch, t: linkedTotal }) });
  if (isNum(batchFrom) && isNum(batchTo) && parseInt(batchFrom, 10) > parseInt(batchTo, 10)) issues.push({ level: 'small', text: t('ing.vSwap') });
  const cuts = issues.filter((i) => i.level === 'cut');
  const rowState = (id, k) => checks.find((c) => c.id === id)?.[k] || 'ok';
  const stateCls = (st) => (st === 'cut' ? '!border-rose-500 !bg-rose-50' : st === 'small' ? '!border-amber-500 !bg-amber-50' : '');
  const sample = { seq: '10', part: 'ABC-12345', desc: 'SAMPLE INGREDIENT NAME' };

  const labelFor = (r) => (
    <IngredientLabel name={title || 'FORMULA NAME'} part={showPart ? r.part : ''} seq={r.seq} desc={r.desc} batch={batchList[0]} />
  );

  return (
    <>
      <div className="ing-ui flex h-screen flex-col bg-slate-100 font-sans text-slate-900">
        <OfflineBanner />
        <header className="flex items-center gap-3 bg-violet-600 px-4 py-3 text-white">
          <button onClick={onBack} className="flex items-center gap-1.5 rounded-md bg-white/15 px-2.5 py-1.5 text-xs font-bold hover:bg-white/25">
            <ArrowLeft size={14} /> {t('ing.back')}
          </button>
          <div className="flex-1">
            <h1 className="text-[17px] font-extrabold leading-tight">{t('ing.title')}</h1>
            <p className="text-xs text-violet-200">{t('ing.subtitle')}</p>
          </div>
          <button onClick={() => setShowGuide(true)} className="flex items-center gap-1.5 rounded-md bg-white/15 px-2.5 py-1.5 text-xs font-bold hover:bg-white/25">
            <HelpCircle size={14} /> {t('help.btn')}
          </button>
          <div className="flex items-center rounded-md bg-white/15 p-0.5 text-[11px] font-extrabold" role="group" aria-label={t('lang')}>
            {['en', 'es'].map((l) => (
              <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l}
                className={`rounded px-2 py-1 ${lang === l ? 'bg-white text-violet-700' : 'text-violet-100 hover:text-white'}`}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          {/* LISTA DE INGREDIENTES */}
          <section className="flex w-[640px] shrink-0 flex-col border-r border-slate-200 bg-white">
            <div className="space-y-3 border-b border-slate-200 p-4">
              <div className="flex gap-2">
                <div className="flex-1">
                  <span className="mb-1 block text-[11px] font-bold text-slate-500">{t('lbl.formula')}</span>
                  <Suggest
                    value={formula} onChange={setFormula} maxLength={20} placeholder={t('ph.formula')} className={inputCls} emptyText={t('formula.none')}
                    options={formulaOptions} onPick={(o) => switchFormula(o.key)} onEnter={() => switchFormula(formula)} onBlur={() => switchFormula(formula)}
                  />
                </div>
                <div className="flex-[1.6]">
                  <span className="mb-1 block text-[11px] font-bold text-slate-500">{t('lbl.name')}</span>
                  <input value={known ? known.name : name} readOnly={Boolean(known)} maxLength={80}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={norm(formula) ? t('ing.namePh') : ''}
                    className={`${inputCls} ${known ? 'bg-slate-50 text-slate-600' : ''} ${stateCls(nameState)}`} />
                </div>
              </div>
              {status && <p className="rounded-md bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">{status}</p>}
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              {norm(formula) && (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="w-14 py-2 pl-3 text-left">{t('ing.print')}</th>
                      <th className="w-20 px-1 text-left">Seq #</th>
                      <th className="w-40 px-1 text-left">{t('ing.part')}</th>
                      <th className="px-1 text-left">{t('ing.desc')}</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.id} onClick={() => setPreview(i)} className={`border-t border-slate-100 ${i === preview ? 'bg-violet-50' : ''}`}>
                        <td className="py-1 pl-3">
                          <input type="checkbox" checked={r.checked} onChange={(e) => patch(r.id, { checked: e.target.checked })} aria-label={`${t('ing.print')} Seq ${r.seq}`} className="h-5 w-5 accent-violet-600" />
                        </td>
                        <td className="px-1 py-1"><input value={r.seq} inputMode="numeric" maxLength={5} className={`${inputCls} ${stateCls(rowState(r.id, 'seq'))}`}
                          onChange={(e) => patch(r.id, { seq: e.target.value.replace(/\D/g, '') })} /></td>
                        <td className="px-1 py-1">
                          <Suggest portal value={r.part} maxLength={30} onChange={(v) => patch(r.id, { part: v })}
                            title={rowState(r.id, 'part') !== 'ok' ? t(rowState(r.id, 'part') === 'cut' ? 'ing.vCut' : 'ing.vSmall', { field: t('ing.part') }) : ''}
                            className={`${inputCls} ${showPart ? stateCls(rowState(r.id, 'part')) : ''}`} emptyText={t('list.noPart')}
                            options={searchParts(catalog, r.part, 8).map((i) => ({ key: i.part, primary: i.part, secondary: i.description, item: i, tag: /^\d{6}$/.test(i.part) ? '' : t('list.variant') }))}
                            onPick={(o) => patch(r.id, { part: o.item.part, desc: o.item.description, lp: o.item.part })}
                            onEnter={() => lookupPart(r)} onBlur={() => lookupPart(r)} />
                        </td>
                        <td className="px-1 py-1"><input value={r.desc} maxLength={80} title={rowState(r.id, 'desc') !== 'ok' ? t(rowState(r.id, 'desc') === 'cut' ? 'ing.vCut' : 'ing.vSmall', { field: t('ing.desc') }) : ''} className={`${inputCls} ${stateCls(rowState(r.id, 'desc'))}`}
                          onChange={(e) => patch(r.id, { desc: e.target.value })} /></td>
                        <td className="pr-2">
                          <button onClick={() => removeRow(r.id)} title={t('ing.remove')} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={14} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {norm(formula) && !rows.length && !busy && <p className="p-6 text-center text-sm text-slate-500">{t('ing.empty')}</p>}
              {!norm(formula) && <p className="p-6 text-center text-sm text-slate-500">{t('ing.start')}</p>}
            </div>

            {norm(formula) && issues.length > 0 && (
              <ul className="max-h-28 space-y-1 overflow-auto border-t border-slate-200 bg-white px-4 py-2" aria-label={t('ing.issues')}>
                {issues.map((i, n) => (
                  <li key={n} className={`flex items-start gap-1.5 text-xs font-bold ${i.level === 'cut' ? 'text-rose-700' : 'text-amber-700'}`}>
                    <AlertTriangle size={13} className="mt-px shrink-0" /> <span>{i.text}</span>
                  </li>
                ))}
              </ul>
            )}

            {norm(formula) && (
              <div className="space-y-2 border-t border-slate-200 bg-slate-50 p-3">
                {showPaste && (
                  <div>
                    <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={5} autoFocus placeholder={t('ing.pastePh')}
                      className={`${inputCls} font-mono`} />
                    <div className="mt-1.5 flex justify-end gap-1.5">
                      <button onClick={() => { setShowPaste(false); setPasteText(''); }} className="rounded-md px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200">{t('fm.close')}</button>
                      <button onClick={applyPaste} disabled={!pasteText.trim()} className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-40">{t('ing.pasteAdd')}</button>
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button onClick={addRow} className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200"><Plus size={14} /> {t('ing.add')}</button>
                  <button onClick={() => setShowPaste((v) => !v)} className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200"><ClipboardPaste size={14} /> {t('ing.paste')}</button>
                  <div className="flex-1" />
                  {!dirty && saved !== null ? (
                    <span className="flex items-center gap-1 text-xs font-bold text-emerald-700"><Check size={14} /> {t('ing.upToDate')}</span>
                  ) : (
                    <button onClick={saveList} disabled={busy || !rows.length || (!known && !norm(name))}
                      title={!known && !norm(name) ? t('ing.needName') : ''}
                      className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-40">
                      <Save size={14} /> {t('ing.save')}
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* VISTA PREVIA E IMPRESIÓN */}
          <main className="flex min-w-0 flex-1 flex-col items-center gap-5 overflow-auto p-8">
            <div className="w-full max-w-[640px]">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">{t('ing.preview')} · 4 × 2 in</p>
              <div className="bg-white shadow-xl ring-1 ring-slate-300">{labelFor(shown || sample)}</div>
            </div>

            <div className="w-full max-w-[640px] space-y-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center gap-3">
                <div className="flex-1" />
                <button onClick={() => { setSeqDraft(null); setRows((rs) => rs.map((r) => ({ ...r, checked: true }))); }} className="text-xs font-bold text-violet-700 hover:underline">{t('ing.all')}</button>
                <button onClick={() => { setSeqDraft(null); setRows((rs) => rs.map((r) => ({ ...r, checked: false }))); }} className="text-xs font-bold text-violet-700 hover:underline">{t('ing.none')}</button>
              </div>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                <span className="shrink-0">{t('ing.seqs')}</span>
                <input value={seqDraft ?? seqSummary} placeholder={t('ing.seqsHint')} className={`${inputCls} flex-1`} onChange={(e) => applySeqs(e.target.value)} onBlur={() => setSeqDraft(null)} />
              </label>
              <p className="text-xs font-semibold text-slate-500">{t('ing.calc', { s: selected.length, b: batchList.length, n: total })}</p>
              <label className="flex cursor-pointer items-center gap-2 border-t border-slate-100 pt-3 text-xs font-bold text-slate-600">
                <input type="checkbox" checked={showPart} onChange={(e) => { setShowPart(e.target.checked); save('lm.ing.showPart', e.target.checked); }} />
                {t('ing.showPart')}
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs font-bold text-slate-600">{t('ing.batchFrom')}</label>
                <input value={batchFrom} inputMode="numeric" maxLength={3} placeholder={t('ph.eg', { x: '1' })} className={`${inputCls} !w-16`}
                  onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); setBatchFrom(v); if (!batchTo || batchTo === batchFrom) setBatchTo(v); }} />
                <label className="text-xs font-bold text-slate-600">{t('ing.batchTo')}</label>
                <input value={batchTo} inputMode="numeric" maxLength={3} placeholder={batchFrom || '1'} className={`${inputCls} !w-16`}
                  onChange={(e) => setBatchTo(e.target.value.replace(/\D/g, ''))} />
                {linkedTotal > 1 && (
                  <button onClick={() => { setBatchFrom('1'); setBatchTo(String(linkedTotal)); }} className="text-xs font-bold text-violet-700 hover:underline">
                    {t('ing.batchAll', { n: linkedTotal })}
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                {norm(linked.formula) && norm(linked.formula).toLowerCase() === norm(formula).toLowerCase() && isNum(linked.batch)
                  ? t('ing.linked', { f: linked.formula, b: linked.batch, n: linkedTotal || '?' }) + ' '
                  : ''}
                {t('ing.batchHint')}
              </p>
              <button onClick={() => doPrint(selected)} disabled={!total || preparing || (dirty && !!validate())}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 py-3 text-sm font-extrabold text-white hover:bg-violet-700 disabled:opacity-40">
                <Printer size={18} />
                {preparing ? t('ing.preparing') : batchList.length > 1
                  ? t('ing.printRange', { n: total, a: batchList[0], b: batchList[batchList.length - 1] })
                  : total === 1 ? t('ing.printOne') : t('ing.printMany', { n: total })}
              </button>
              {dirty && rows.length > 0 && <p className="text-center text-[11px] font-semibold text-amber-700">{t('ing.unsaved')}</p>}
            </div>

            <details className="w-full max-w-[640px] rounded-xl bg-white p-4 text-sm shadow-sm ring-1 ring-slate-200">
              <summary className="cursor-pointer text-xs font-bold text-slate-600">{t('ing.calib')}</summary>
              <p className="mt-2 text-xs text-slate-500">{t('ing.calibHelp')} {t('ing.darkHelp')}</p>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                {[['x', t('ing.offX')], ['y', t('ing.offY')]].map(([k, label]) => (
                  <label key={k} className="block">
                    <span className="mb-1 block text-[11px] font-bold text-slate-500">{label}</span>
                    <input type="number" step="0.5" min="-10" max="10" value={offset[k]} onChange={(e) => setOff(k, e.target.value)} className={`${inputCls} !w-24`} />
                  </label>
                ))}
                <label className="block">
                  <span className="mb-1 block text-[11px] font-bold text-slate-500">{t('ing.dark')}</span>
                  <select value={offset.dark} onChange={(e) => setOff('dark', Number(e.target.value))} className={`${inputCls} !w-36`}>
                    {[0, 1, 2, 3].map((n) => <option key={n} value={n}>{t(`ing.dark${n}`)}</option>)}
                  </select>
                </label>
                <button onClick={() => doPrint([sample], true)} className="flex items-center gap-1.5 rounded-md bg-slate-700 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800">
                  <Printer size={14} /> {t('ing.test')}
                </button>
                <button onClick={printDotTest} className="flex items-center gap-1.5 rounded-md bg-slate-500 px-3 py-2 text-xs font-bold text-white hover:bg-slate-600">
                  <Printer size={14} /> {t('ing.dotTest')}
                </button>
              </div>
            </details>
          </main>
        </div>
      </div>

      {showGuide && <WelcomeGuide kind="labels" onClose={closeGuide} />}
      <div className="ing-ui"><Toast toast={toast} onUndo={() => {}} /></div>

      {/* SALIDA DE IMPRESIÓN: una página de 4 x 2 in por etiqueta */}
      <div className="ing-print">
        {printJob &&
          printJob.images.map((src, i) => (
            <div key={i} className="ing-sheet">
              <img src={src} alt="" />
            </div>
          ))}
      </div>
    </>
  );
}
