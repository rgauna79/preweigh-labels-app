import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, ClipboardPaste, FileUp, Plus, Printer, Save, Trash2, X } from 'lucide-react';
import Papa from 'papaparse';
import { useLang } from './i18n.js';
import Toast from './Toast.jsx';
import IngredientLabel from './IngredientLabel.jsx';
import { DIL_X, DIL_Y, DPI, THRESHOLDS, labelBitmap, testBitmap } from './rasterize.js';
import { fetchBom, fetchBomIndex, fetchFormulas, fetchItem, writeBom, writeFormulas, writeItems } from './api.js';

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
const newRow = (seq = '', part = '', desc = '') => ({ id: ++uid, seq: String(seq), part, desc, checked: true });
const nextSeq = (rows) => String((Math.floor(Math.max(0, ...rows.map((r) => parseInt(r.seq, 10) || 0)) / 10) + 1) * 10);

/** Convierte lo pegado desde Excel ("part⇥descripción" por línea) en filas con secuencia 10, 20, 30… */
function parsePaste(text, startSeq = 10) {
  return text
    .split(/\r?\n/)
    .map((l) => l.split('\t').map(norm))
    .filter((c) => c.some(Boolean))
    .map((c, i) => newRow(startSeq + i * 10, c[0] || '', c.slice(1).join(' ')));
}

export default function IngredientLabels({ onBack }) {
  const { lang, setLang, t } = useLang();
  const [formulas, setFormulas] = useState([]);
  const [index, setIndex] = useState([]); // fórmulas que ya tienen lista de ingredientes
  const [formula, setFormula] = useState(() => load('lm.ing.formula', ''));
  const [name, setName] = useState('');
  const [rows, setRows] = useState([]);
  const [saved, setSaved] = useState(null); // copia guardada (para saber si hay cambios), null = fórmula sin lista
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(0);
  const [batch, setBatch] = useState(() => load('lm.ing.batch', ''));
  const [copies, setCopies] = useState(1);
  const [offset, setOffset] = useState(() => ({ x: 2, y: 1, dark: 0, ...load('lm.ing.offset', {}) })); // calibración en mm
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [toast, setToast] = useState(null);
  const [printJob, setPrintJob] = useState(null); // [{ seq, part, desc }] mientras se imprime
  const toastTimer = useRef(null);
  const csvRef = useRef(null);

  const flash = (text) => {
    clearTimeout(toastTimer.current);
    setToast({ text });
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  };

  useEffect(() => {
    fetchFormulas().then(setFormulas).catch(() => setStatus(t('err.offline')));
    fetchBomIndex().then(setIndex).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const known = useMemo(() => formulas.find((f) => f.formula.toLowerCase() === norm(formula).toLowerCase()), [formulas, formula]);
  const hasList = useMemo(() => index.some((b) => b.formula.toLowerCase() === norm(formula).toLowerCase()), [index, formula]);
  const snapshot = (list) => JSON.stringify(list.map((r) => [parseInt(r.seq, 10) || 0, norm(r.part), norm(r.desc)]));
  const dirty = saved === null ? rows.length > 0 : snapshot(rows) !== saved;

  /** Carga la lista guardada de la fórmula escrita (si existe). */
  const loadFormula = async (value = formula) => {
    const f = norm(value);
    save('lm.ing.formula', f);
    if (!f) { setRows([]); setSaved(null); setName(''); setStatus(''); return; }
    setBusy(true);
    setStatus('');
    try {
      const bom = await fetchBom(f);
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

  /** Al salir del número de parte: si la descripción está vacía, se busca en el catálogo. */
  const lookupPart = async (row) => {
    const part = norm(row.part);
    if (!part || norm(row.desc)) return;
    try {
      const item = await fetchItem(part);
      if (item?.description) patch(row.id, { desc: item.description });
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

  const importCatalog = (file) => {
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.replace(/^﻿/, '').trim().toLowerCase(),
      complete: async ({ data }) => {
        const items = data
          .map((r) => ({ part: norm(r.part ?? r['part number'] ?? r.item ?? r['item code']), description: norm(r.description ?? r.desc ?? r.name) }))
          .filter((r) => r.part);
        if (!items.length) { setStatus(t('ing.importNone')); return; }
        setBusy(true);
        try {
          for (let i = 0; i < items.length; i += 2000) await writeItems('upsert', items.slice(i, i + 2000));
          flash(t('ing.imported', { n: items.length }));
        } catch (e) {
          setStatus(e.message);
        } finally {
          setBusy(false);
          if (csvRef.current) csvRef.current.value = '';
        }
      },
    });
  };

  // --- Impresión: una página de 4 x 2 in por etiqueta
  const selected = rows.filter((r) => r.checked && (norm(r.part) || norm(r.desc)));
  const total = selected.length * copies;

  const printDotTest = () => setPrintJob({ images: [testBitmap()], copies: 1 });

  const doPrint = async (list, test = false) => {
    setStatus('');
    try {
      const mmToDots = (v) => (mm(v) * DPI) / 25.4;
      const images = await Promise.all(
        list.map((r) =>
          labelBitmap(
            { name: test ? 'FORMULA NAME' : title, part: r.part, seq: r.seq, desc: r.desc, batch: test ? '1' : norm(batch) },
            { threshold: THRESHOLDS[offset.dark] ?? THRESHOLDS[2], dilY: DIL_Y[offset.dark] ?? 1, dilX: DIL_X[offset.dark] ?? 0, dx: mmToDots(offset.x), dy: mmToDots(offset.y) }
          )
        )
      );
      setPrintJob({ images, copies: test ? 1 : copies });
    } catch (e) {
      setStatus(e.message);
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
  const sample = { seq: '10', part: 'ABC-12345', desc: 'SAMPLE INGREDIENT NAME' };

  const labelFor = (r) => (
    <IngredientLabel name={title || 'FORMULA NAME'} part={r.part} seq={r.seq} desc={r.desc} batch={norm(batch)} />
  );

  return (
    <>
      <div className="ing-ui flex h-screen flex-col bg-slate-100 font-sans text-slate-900">
        <header className="flex items-center gap-3 bg-violet-600 px-4 py-3 text-white">
          <button onClick={onBack} className="flex items-center gap-1.5 rounded-md bg-white/15 px-2.5 py-1.5 text-xs font-bold hover:bg-white/25">
            <ArrowLeft size={14} /> {t('ing.back')}
          </button>
          <div className="flex-1">
            <h1 className="text-[17px] font-extrabold leading-tight">{t('ing.title')}</h1>
            <p className="text-xs text-violet-200">{t('ing.subtitle')}</p>
          </div>
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
                  <input list="ing-formulas" value={formula} maxLength={20} placeholder={t('ph.formula')} className={inputCls}
                    onChange={(e) => setFormula(e.target.value)}
                    onBlur={() => loadFormula()}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
                  <datalist id="ing-formulas">
                    {index.map((b) => <option key={b.formula} value={b.formula} />)}
                  </datalist>
                </div>
                <div className="flex-[1.6]">
                  <span className="mb-1 block text-[11px] font-bold text-slate-500">{t('lbl.name')}</span>
                  <input value={known ? known.name : name} readOnly={Boolean(known)} maxLength={80}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={norm(formula) ? t('ing.namePh') : ''}
                    className={`${inputCls} ${known ? 'bg-slate-50 text-slate-600' : ''}`} />
                </div>
              </div>
              {status && <p className="rounded-md bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">{status}</p>}
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              {norm(formula) && (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="w-8 py-2 pl-3 text-left"><span className="sr-only">{t('ing.print')}</span></th>
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
                          <input type="checkbox" checked={r.checked} onChange={(e) => patch(r.id, { checked: e.target.checked })} aria-label={t('ing.print')} />
                        </td>
                        <td className="px-1 py-1"><input value={r.seq} inputMode="numeric" maxLength={5} className={inputCls}
                          onChange={(e) => patch(r.id, { seq: e.target.value.replace(/\D/g, '') })} /></td>
                        <td className="px-1 py-1"><input value={r.part} maxLength={30} className={inputCls}
                          onChange={(e) => patch(r.id, { part: e.target.value })} onBlur={() => lookupPart(r)} /></td>
                        <td className="px-1 py-1"><input value={r.desc} maxLength={80} className={inputCls}
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
                  <button onClick={() => csvRef.current?.click()} title={t('ing.importHint')} className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200"><FileUp size={14} /> {t('ing.import')}</button>
                  <input ref={csvRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => importCatalog(e.target.files?.[0])} />
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
                <label className="text-xs font-bold text-slate-600">{t('lbl.batch')}</label>
                <input value={batch} maxLength={10} placeholder="1" className={`${inputCls} !w-24`}
                  onChange={(e) => { setBatch(e.target.value); save('lm.ing.batch', e.target.value); }} />
                <label className="ml-2 text-xs font-bold text-slate-600">{t('ing.copies')}</label>
                <input type="number" min={1} max={20} value={copies} className={`${inputCls} !w-16`}
                  onChange={(e) => setCopies(Math.min(20, Math.max(1, parseInt(e.target.value, 10) || 1)))} />
                <div className="flex-1" />
                <button onClick={() => setRows((rs) => rs.map((r) => ({ ...r, checked: true })))} className="text-xs font-bold text-violet-700 hover:underline">{t('ing.all')}</button>
                <button onClick={() => setRows((rs) => rs.map((r) => ({ ...r, checked: false })))} className="text-xs font-bold text-violet-700 hover:underline">{t('ing.none')}</button>
              </div>
              <button onClick={() => doPrint(selected)} disabled={!total || dirty && !!validate()}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 py-3 text-sm font-extrabold text-white hover:bg-violet-700 disabled:opacity-40">
                <Printer size={18} /> {total === 1 ? t('ing.printOne') : t('ing.printMany', { n: total })}
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

      <div className="ing-ui"><Toast toast={toast} onUndo={() => {}} /></div>

      {/* SALIDA DE IMPRESIÓN: una página de 4 x 2 in por etiqueta */}
      <div className="ing-print">
        {printJob &&
          Array.from({ length: printJob.copies }).flatMap((_, c) =>
            printJob.images.map((src, i) => (
              <div key={`${c}-${i}`} className="ing-sheet">
                <img src={src} alt="" />
              </div>
            ))
          )}
      </div>
    </>
  );
}
