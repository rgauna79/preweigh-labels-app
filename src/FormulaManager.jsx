import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, Loader2, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { useLang } from './i18n.js';
import { downloadText, formulasToCsv, parseFormulasCsv } from './formulas.js';

const cell =
  'w-full px-2.5 py-1.5 border border-transparent hover:border-slate-300 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 rounded-md bg-transparent text-sm font-semibold outline-none';

/** Aviso grande: los errores se quedan hasta cerrarlos; los éxitos se van solos. */
function Notice({ notice, onDismiss }) {
  const { t } = useLang();
  const isError = notice.type === 'error';
  return (
    <div
      role={isError ? 'alert' : 'status'}
      className={`lm-slide mx-5 mt-3 flex items-start gap-3 rounded-lg border-l-4 px-4 py-3 shadow-sm ${
        isError ? 'bg-rose-50 border-rose-600 text-rose-900' : 'bg-emerald-50 border-emerald-600 text-emerald-900'
      }`}
    >
      {isError ? <AlertTriangle size={22} className="shrink-0 text-rose-600" /> : <CheckCircle2 size={22} className="shrink-0 text-emerald-600" />}
      <div className="flex-1 min-w-0">
        {isError && <p className="text-sm font-extrabold">{t('fm.errorTitle')}</p>}
        <p className={`text-sm ${isError ? 'font-semibold' : 'font-bold'} break-words`}>{notice.text}</p>
      </div>
      <button onClick={onDismiss} aria-label={t('fm.dismiss')} className="p-1 rounded hover:bg-black/10 shrink-0">
        <X size={16} />
      </button>
    </div>
  );
}

/** Una fila: se edita en local y se guarda en el servidor al salir del campo. */
function Row({ entry, isNew, duplicate, onSave, onDelete, onDiscard }) {
  const { t } = useLang();
  const [formula, setFormula] = useState(entry.formula);
  const [name, setName] = useState(entry.name);
  const [state, setState] = useState('idle'); // idle | saving | saved | error

  const commit = async () => {
    const next = { ...entry, formula: formula.trim(), name: name.trim() };
    if (!next.formula) return; // sin código no hay nada que guardar
    if (!isNew && next.formula === entry.formula && next.name === entry.name) return;
    setState('saving');
    const ok = await onSave(isNew ? null : entry.formula, next);
    setState(ok ? 'saved' : 'error');
  };

  useEffect(() => {
    if (state !== 'saved') return undefined;
    const id = setTimeout(() => setState('idle'), 1300);
    return () => clearTimeout(id);
  }, [state]);

  const border = state === 'error' ? '!border-rose-500 bg-rose-50' : '';
  return (
    <div
      className={`grid grid-cols-[130px_1fr_36px] gap-1 items-center rounded-md ${state === 'saved' ? 'lm-flash' : ''} ${state === 'error' ? 'lm-shake' : ''}`}
      title={state === 'error' ? t('fm.rowError') : undefined}
    >
      <input
        value={formula} onChange={(e) => setFormula(e.target.value)} onBlur={commit} placeholder="300909" autoFocus={isNew}
        disabled={state === 'saving'}
        className={`${cell} ${border} ${duplicate ? '!border-amber-400 bg-amber-50' : ''}`} title={duplicate ? t('fm.dup') : undefined}
      />
      <input
        value={name} onChange={(e) => setName(e.target.value)} onBlur={commit} placeholder={t('fm.namePh')}
        disabled={state === 'saving'} className={`${cell} ${border}`}
      />
      {state === 'saving' ? (
        <span className="p-2 text-violet-600" aria-label={t('fm.saving')}><Loader2 size={16} className="animate-spin" /></span>
      ) : state === 'error' ? (
        <span className="p-2 text-rose-600"><AlertTriangle size={16} /></span>
      ) : (
        <button
          onClick={() => (isNew ? onDiscard() : onDelete(entry.formula))}
          className="p-2 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50" aria-label={t('fm.delete')}
        >
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}

/** Ventana compartida para agregar, editar y borrar fórmulas (código + nombre). */
export default function FormulaManager({ formulas, onSave, onDelete, onImport, onClose }) {
  const { t } = useLang();
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState(null); // { type: 'error' | 'success', text }
  const [busy, setBusy] = useState(null); // texto de la tarea larga en curso (importar / borrar)
  const [adding, setAdding] = useState(false);
  const timer = useRef(null);

  const show = (type, text) => {
    clearTimeout(timer.current);
    setNotice({ type, text });
    if (type === 'success') timer.current = setTimeout(() => setNotice(null), 4000);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  const q = query.trim().toLowerCase();
  const rows = useMemo(
    () => formulas.filter((f) => !q || f.formula.toLowerCase().includes(q) || f.name.toLowerCase().includes(q)),
    [formulas, q]
  );

  const duplicates = useMemo(() => {
    const seen = new Map();
    formulas.forEach((f) => {
      const k = f.formula.trim().toLowerCase();
      if (k) seen.set(k, (seen.get(k) || 0) + 1);
    });
    return new Set([...seen].filter(([, n]) => n > 1).map(([k]) => k));
  }, [formulas]);

  /** Ejecuta una acción; devuelve true si salió bien. Los errores quedan en un aviso rojo. */
  const run = async (fn, okText) => {
    try {
      await fn();
      if (okText) show('success', okText);
      return true;
    } catch (err) {
      show('error', t('fm.notSaved', { err: err.message }));
      return false;
    }
  };

  const save = (old, entry) => run(async () => { await onSave(old, entry); setAdding(false); }, t('fm.saved'));

  const remove = async (code) => {
    if (!confirm(t('fm.confirmDelete', { code }))) return;
    setBusy(t('fm.saving'));
    await run(() => onDelete(code), t('fm.saved'));
    setBusy(null);
  };

  const importCsv = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setNotice(null);
    setBusy(t('fm.reading'));
    parseFormulasCsv(file, async (list) => {
      if (!list.length) {
        setBusy(null);
        return show('error', t('fm.importNone'));
      }
      setBusy(t('fm.uploading', { n: list.length }));
      await run(() => onImport(list), t('fm.imported', { n: list.length }));
      setBusy(null);
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-full flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Barra de progreso indeterminada mientras hay una tarea larga */}
        {busy && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-violet-100 overflow-hidden z-10" role="progressbar" aria-label={busy}>
            <div className="lm-bar bg-violet-600 rounded-full" />
          </div>
        )}

        <header className="flex items-center gap-3 px-5 py-4 border-b border-slate-200">
          <h2 className="text-lg font-extrabold flex-1">{t('fm.title', { n: formulas.length })}</h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-slate-100" aria-label={t('fm.close')}><X size={18} /></button>
        </header>

        {notice && <Notice notice={notice} onDismiss={() => setNotice(null)} />}

        <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-slate-100">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={15} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('fm.search')}
              className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          <button disabled={!!busy} onClick={() => { setQuery(''); setAdding(true); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold disabled:opacity-50">
            <Plus size={15} /> {t('fm.add')}
          </button>
          <label className={`flex items-center gap-1.5 px-3 py-2 rounded-md bg-slate-100 text-sm font-semibold ${busy ? 'opacity-50 pointer-events-none' : 'hover:bg-slate-200 cursor-pointer'}`}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} {t('fm.import')}
            <input type="file" accept=".csv,text/csv" onChange={importCsv} disabled={!!busy} className="hidden" />
          </label>
          <button disabled={!!busy} onClick={() => downloadText('formulas.csv', formulasToCsv(formulas))}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-slate-100 hover:bg-slate-200 text-sm font-semibold disabled:opacity-50">
            <Download size={15} /> {t('fm.export')}
          </button>
        </div>

        <div className="relative overflow-y-auto flex-1 px-3 py-2 min-h-[160px]">
          <div className="grid grid-cols-[130px_1fr_36px] gap-1 px-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <span>{t('fm.colFormula')}</span><span>{t('fm.colName')}</span><span />
          </div>
          <div className={busy ? 'opacity-40 pointer-events-none transition-opacity' : 'transition-opacity'}>
            {adding && <Row key="new" isNew entry={{ formula: '', name: '', ile: '' }} onSave={save} onDiscard={() => setAdding(false)} />}
            {rows.map((f) => (
              <Row key={f.formula} entry={f} duplicate={duplicates.has(f.formula.trim().toLowerCase())} onSave={save} onDelete={remove} />
            ))}
            {!rows.length && !adding && (
              <p className="text-sm text-slate-500 text-center py-10">{formulas.length ? t('fm.noResults') : t('fm.noneYet')}</p>
            )}
          </div>
          {busy && (
            <div className="lm-slide absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="flex items-center gap-3 rounded-full bg-white shadow-lg border border-violet-200 px-5 py-3 text-sm font-bold text-violet-800">
                <Loader2 size={20} className="animate-spin text-violet-600" /> {busy}
              </div>
            </div>
          )}
        </div>

        <footer className="px-5 py-3 border-t border-slate-200 text-xs text-slate-500">{t('fm.footer')}</footer>
      </div>
    </div>
  );
}
