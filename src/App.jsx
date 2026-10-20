import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, BookmarkPlus, CheckCircle2, ChevronsRight, Clock, Eraser, Info, Minus, Plus, Printer, Settings as Cog, Tag, X } from 'lucide-react';
import { useLang } from './i18n.js';
import FormulaManager from './FormulaManager.jsx';
import ListField from './ListField.jsx';
import Modal from './Modal.jsx';
import Toast from './Toast.jsx';
import HistoryModal from './HistoryModal.jsx';
import SettingsModal from './SettingsModal.jsx';
import PrintConfirm from './PrintConfirm.jsx';
import { collectChecks, findIdUse, fmtStamp } from './checks.js';
import { LIMITS } from './limits.js';
import { addHistory, deleteLogo, fetchFormulas, fetchHistory, fetchLogo, shrinkImage, uploadLogo, writeFormulas } from './api.js';
import { LABEL_H, LABEL_W, batchesText, buildSheets, stripId, toItems } from './Labels.jsx';

const MAX_PALLETS = 15; // tope de pallets por batch (lo normal es 1-3; algunos kits llegan a 5-6)

/** "3" o "2-5, 8" → Set de números; null si está vacío. */
const parseRanges = (txt) => {
  const set = new Set();
  String(txt || '').split(/[,;\s]+/).filter(Boolean).forEach((p) => {
    const m = p.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) return;
    const a = +m[1]; const b = m[2] ? +m[2] : a;
    for (let i = Math.min(a, b); i <= Math.max(a, b) && i <= 999; i++) set.add(i);
  });
  return set.size ? set : null;
};

const EMPTY = {
  date: '', formula: '', name: '', batch: '', batchTotal: '', batchesCustom: false, po: '', batches: '', ile: 'ILE', identifier: '',
  missing: '', refer: '',
};

const todayStr = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}/${p(d.getDate())}/${String(d.getFullYear()).slice(-2)}`;
};

const load = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
};
const save = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* almacenamiento lleno o bloqueado: la app sigue funcionando */
  }
};

const inputCls =
  'w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none';

/** Campo con su título visible encima (el texto de ayuda desaparece al escribir, el título no). */
function Labeled({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function Section({ title, action, children }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function App({ onOpenIngredients }) {
  const { lang, setLang, t } = useLang();
  const [data, setData] = useState(() => ({ ...EMPTY, ...load('lm.data', {}), date: todayStr() }));
  const [job, setJob] = useState(() => ({ pallets: 1, withMissing: false, withRefer: false, copies: 1, ...load('lm.job', {}) }));
  const [formulas, setFormulas] = useState([]);
  const [showFormulas, setShowFormulas] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyError, setHistoryError] = useState('');
  const [confirmChecks, setConfirmChecks] = useState(null); // revisión previa a imprimir (null = cerrada)
  const [by, setBy] = useState(() => load('lm.by', ''));
  const [stamp, setStamp] = useState(() => load('lm.stamp', false));
  const [printedAt, setPrintedAt] = useState(null);
  const [toast, setToast] = useState(null); // { text, undo }
  const toastTimer = useRef(null);
  const [logo, setLogo] = useState(null);
  const [statusObj, setStatusObj] = useState(null); // { text, type: 'info' | 'success' | 'error' }
  const setStatus = (text, type = 'info') => setStatusObj(text ? { text, type } : null);
  const [serverError, setServerError] = useState('');

  useEffect(() => save('lm.data', { ...data, date: '' }), [data]);
  useEffect(() => save('lm.job', job), [job]);
  useEffect(() => save('lm.by', by), [by]);
  useEffect(() => save('lm.stamp', stamp), [stamp]);

  const sheets = useMemo(() => buildSheets(data, job), [data, job]);
  // Hojas que NO se imprimen (por clave). Se reinicia al cambiar de batch.
  const [excluded, setExcluded] = useState([]);
  const [palletFilter, setPalletFilter] = useState('');
  const included = useMemo(() => sheets.filter((x) => !excluded.includes(x.key)), [sheets, excluded]);
  const toggleSheet = (key) => setExcluded((e) => (e.includes(key) ? e.filter((k) => k !== key) : [...e, key]));
  const typeOf = (k) => (k.startsWith('pre') ? 'pre' : k.startsWith('mis') ? 'mis' : k);
  const toggleType = (ty) => {
    const keys = sheets.filter((x) => typeOf(x.key) === ty).map((x) => x.key);
    const allOn = keys.every((k) => !excluded.includes(k));
    setExcluded((e) => (allOn ? [...new Set([...e, ...keys])] : e.filter((k) => !keys.includes(k))));
  };
  const applyPalletFilter = (txt) => {
    setPalletFilter(txt);
    const set = parseRanges(txt);
    setExcluded((e) => {
      const rest = e.filter((k) => !/^(pre|mis)\d+$/.test(k));
      if (!set) return rest;
      return [...rest, ...sheets.filter((x) => /^(pre|mis)\d+$/.test(x.key) && !set.has(parseInt(x.key.replace(/\D/g, ''), 10))).map((x) => x.key)];
    });
  };
  const [showPick, setShowPick] = useState(false);
  const resetSelection = () => { setExcluded([]); setPalletFilter(''); };

  // --- Vista previa escalada al ancho disponible ---
  const wrapRef = useRef(null);
  const [scale, setScale] = useState(0.7);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth - 64;
      setScale(Math.max(0.3, Math.min(1, w / LABEL_W)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const set = (name, value) => setData((d) => ({ ...d, [name]: value }));
  const onChange = (e) => {
    const { name } = e.target;
    let { value } = e.target;
    if (name === 'date') dateEdited.current = true;
    if (name === 'batchTotal') value = value.replace(/\D/g, ''); // el total solo lleva dígitos
    if (typeof LIMITS[name] === 'number') value = value.slice(0, LIMITS[name]);
    set(name, value);
  };

  // Enter pasa al siguiente campo (la fórmula se excluye: ahí Enter elige de la lista de sugerencias)
  const onEnterNext = (e) => {
    const el = e.target;
    if (e.key !== 'Enter' || el.tagName !== 'INPUT' || el.type === 'checkbox' || el.type === 'file' || el.name === 'formula') return;
    e.preventDefault();
    const fields = [...e.currentTarget.querySelectorAll('input:not([type=checkbox]):not([type=file]), textarea')];
    fields[fields.indexOf(el) + 1]?.focus();
  };

  const norm = (s) => String(s ?? '').trim();

  const applyFormula = (value) => {
    const match = formulas.find((f) => f.formula.toLowerCase() === norm(value).toLowerCase());
    setData((d) => ({
      ...d,
      formula: value,
      ...(match ? { name: match.name || d.name, ile: match.ile || 'ILE' } : {}),
    }));
    setStatus(
      formulas.length && norm(value) && !match ? t('status.new', { f: norm(value) }) : ''
    );
  };

  // --- Datos compartidos (servidor): fórmulas y logo ---
  const refresh = () => {
    fetchFormulas().then((list) => { setFormulas(list); setServerError(''); })
      .catch(() => setServerError(t('err.offline')));
    fetchLogo().then(setLogo).catch(() => {});
    fetchHistory().then((h) => { setHistory(h); setHistoryError(''); }).catch(() => setHistoryError(t('hist.error')));
  };
  // La fecha es la de hoy salvo que se haya escrito otra a mano.
  const dateEdited = useRef(false);
  useEffect(() => {
    const onFocus = () => {
      refresh(); // otra persona pudo cambiar algo mientras tanto
      if (!dateEdited.current) setData((d) => ({ ...d, date: todayStr() })); // la app pudo quedar abierta de un día a otro
    };
    refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);
  const setToday = () => {
    dateEdited.current = false;
    set('date', todayStr());
  };

  const trimmedFormula = norm(data.formula);
  const saved = formulas.find((f) => f.formula.toLowerCase() === trimmedFormula.toLowerCase());
  const canSaveFormula = trimmedFormula && norm(data.name) && (!saved || saved.name !== norm(data.name));
  const entryFromForm = () => ({ formula: trimmedFormula, name: norm(data.name), ile: saved?.ile || '' });

  const saveFormula = async () => {
    try {
      setFormulas(await writeFormulas(saved ? 'upsert' : 'add', [entryFromForm()]));
      setStatus(saved ? t('status.updated', { f: trimmedFormula }) : t('status.saved', { f: trimmedFormula }), 'success');
    } catch (err) {
      setStatus(err.message, 'error');
    }
  };

  // Acciones del administrador de fórmulas (cada cambio se guarda en el servidor).
  const saveEntry = async (oldCode, entry) => {
    if (oldCode && oldCode.toLowerCase() !== entry.formula.toLowerCase()) await writeFormulas('delete', [{ formula: oldCode }]);
    setFormulas(await writeFormulas('upsert', [entry]));
  };
  const deleteEntry = async (code) => setFormulas(await writeFormulas('delete', [{ formula: code }]));
  const importEntries = async (list) => setFormulas(await writeFormulas('upsert', list));

  const changeLogo = async (file) => {
    try {
      await uploadLogo(await shrinkImage(file));
      setLogo(await fetchLogo());
      setStatus(t('status.logoUpdated'), 'success');
    } catch (err) {
      setStatus(err.message, 'error');
    }
  };
  const removeLogo = async () => {
    try { await deleteLogo(); setLogo(null); setStatus(t('status.logoRemoved'), 'success'); } catch (err) { setStatus(err.message, 'error'); }
  };

  // Avisos previos a imprimir; si hay alguno se pide confirmar, si no se imprime directo.
  const checks = collectChecks({ data, job, history, t });
  const idUse = findIdUse(history, data);
  const breakdown = t('breakdown', {
    pre: included.filter((x) => x.key.startsWith('pre')).length,
    mis: included.filter((x) => x.key.startsWith('mis')).length,
    ref: included.filter((x) => x.key.startsWith('ref')).length,
  });
  const copies = job.copies || 1;
  const totalSheets = included.length * copies;
  const partial = included.length < sheets.length;

  const printSet = () => (checks.length ? setConfirmChecks(checks) : doPrint());

  // Al imprimir: la fórmula nueva se agrega a la lista, la impresión queda en el historial y se abre el diálogo.
  const doPrint = async () => {
    setConfirmChecks(null);
    if (trimmedFormula && norm(data.name) && !saved) {
      try { setFormulas(await writeFormulas('add', [entryFromForm()])); } catch { /* imprimir igual */ }
    }
    const entry = {
      formula: trimmedFormula, name: norm(data.name), batch: norm(data.batch), batchTotal: norm(data.batchTotal),
      batches: batchesText(data), po: norm(data.po), date: norm(data.date), ile: norm(data.ile), identifier: stripId(data.identifier),
      pallets: job.pallets, withMissing: job.withMissing, withRefer: job.withRefer,
      missing: job.withMissing ? data.missing : '', refer: job.withRefer ? data.refer : '', by: norm(by),
    };
    setHistory((h) => [{ ...entry, ts: Date.now() }, ...h]);
    addHistory(entry).catch(() => {}); // si falla, no impide imprimir
    setPrintedAt(Date.now());
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); // deja pintar la hora antes de abrir el diálogo
    window.print();
  };

  // --- Deshacer: "Nuevo", "Siguiente batch" y "Cargar" guardan una copia para poder volver
  const showToast = (text, snapshot) => {
    clearTimeout(toastTimer.current);
    setToast({ text, undo: snapshot });
    toastTimer.current = setTimeout(() => setToast(null), 7000);
  };
  const snapshot = () => ({ data, job, edited: dateEdited.current });
  const restore = (snap) => {
    setData(snap.data);
    setJob(snap.job);
    dateEdited.current = snap.edited;
    setToast(null);
  };

  // Cargar un batch del historial para reimprimirlo
  const loadFromHistory = (h) => {
    const snap = snapshot();
    const auto = h.batch && h.batchTotal && h.batches === `${h.batch}/${h.batchTotal}`;
    dateEdited.current = true;
    setData({
      ...EMPTY, formula: h.formula, name: h.name, batch: h.batch, batchTotal: h.batchTotal, batchesCustom: !auto, batches: auto ? '' : h.batches,
      po: h.po, date: h.date || todayStr(), ile: h.ile || 'ILE', identifier: h.identifier, missing: h.missing || '', refer: h.refer || '',
    });
    resetSelection();
    setJob((j) => ({ ...j, pallets: h.pallets || 1, withMissing: Boolean(h.withMissing), withRefer: Boolean(h.withRefer) }));
    setShowHistory(false);
    showToast(t('toast.loaded', { f: h.formula, b: h.batches || h.batch || '—' }), snap);
  };

  // Pasar a texto manual parte del valor automático ("3/12") para poder editarlo; volver a automático lo descarta.
  const toggleCustomBatches = () =>
    setData((d) => (d.batchesCustom ? { ...d, batchesCustom: false } : { ...d, batchesCustom: true, batches: batchesText(d) }));

  // Siguiente batch de la misma fórmula: batch +1; se conserva todo lo que se repite y solo se vacía el ID.
  const idInput = useRef(null);
  // Batch y total numéricos: el batch nunca puede ser mayor que el total (no existe el 4/2).
  const isNum = (v) => /^\d+$/.test(norm(v));
  const numericPair = !data.batchesCustom && isNum(data.batch) && isNum(data.batchTotal);
  const batchOverTotal = numericPair && parseInt(data.batch, 10) > parseInt(data.batchTotal, 10);
  const atLastBatch = numericPair && parseInt(data.batch, 10) >= parseInt(data.batchTotal, 10);

  const nextBatch = () => {
    if (atLastBatch) return;
    const snap = snapshot();
    const n = /^\d+$/.test(norm(data.batch)) ? String(parseInt(data.batch, 10) + 1) : data.batch;
    // Solo cambia el ID: los faltantes y refrigerados se repiten entre batches de la misma fórmula y se conservan
    setData((d) => ({ ...d, batch: n, identifier: '' }));
    resetSelection();
    showToast(t('toast.next', { b: n || '—' }), snap);
    idInput.current?.focus(); // lo siguiente que hay que escribir es el ID
  };

  const newBatch = () => {
    const snap = snapshot();
    setData((d) => ({ ...EMPTY, date: dateEdited.current ? d.date : todayStr(), ile: d.ile }));
    resetSelection();
    showToast(t('toast.cleared'), snap);
  };

  const required = {
    formula: 'Formula', name: 'Name', batch: 'Batch#', po: 'P.O.#', batches: 'Batches', identifier: 'ID',
  };
  const effective = { ...data, batches: batchesText(data) };
  const emptyFields = Object.entries(required).filter(([k]) => !norm(effective[k])).map(([, l]) => l);
  if (job.withMissing && !toItems(data.missing, LIMITS.missing).length) emptyFields.push(t('empty.missing'));
  if (job.withRefer && !toItems(data.refer, LIMITS.refer).length) emptyFields.push(t('empty.refer'));

  const text = (name, placeholder, extra = '', attrs = {}) => (
    <input key={name} name={name} value={data[name]} onChange={onChange} placeholder={placeholder}
      maxLength={typeof LIMITS[name] === 'number' ? LIMITS[name] : undefined} className={`${inputCls} ${extra}`} {...attrs} />
  );

  // Campo con título y límite de caracteres: avisa al acercarse y al llegar al tope
  const limited = (name, label, placeholder = '') => {
    const max = LIMITS[name];
    const n = data[name].length;
    const atLimit = n >= max;
    return (
      <Labeled label={label}>
        <input key={name} name={name} value={data[name]} onChange={onChange} maxLength={max} placeholder={placeholder}
          className={`${inputCls} ${atLimit ? '!border-rose-500 !bg-rose-50' : ''}`} />
        {n >= max * 0.8 && (
          <span className={`mt-1 block text-right text-[11px] font-bold ${atLimit ? 'text-rose-700' : 'text-amber-700'}`}>
            {atLimit ? t('limit.reached', { n, max }) : t('limit.count', { n, max })}
          </span>
        )}
      </Labeled>
    );
  };

  return (
    <>
      <div className="app-root flex h-screen bg-slate-100 font-sans text-slate-900">
        {/* PANEL DE DATOS */}
        <aside className="w-[380px] shrink-0 bg-white border-r border-slate-200 flex flex-col">
          <header className="px-4 py-4 bg-violet-600 text-white flex items-center gap-2.5">
            <img src="/favicon.svg" alt="" className="w-8 h-8 shrink-0 rounded-lg ring-2 ring-white/70" />
            <div className="flex-1">
              <h1 className="text-[17px] font-extrabold leading-tight whitespace-nowrap">Label Master</h1>
              <p className="text-xs text-violet-200">{t('subtitle')}</p>
            </div>
            <div className="flex items-center rounded-md bg-white/15 p-0.5 text-[11px] font-extrabold" role="group" aria-label={t('lang')}>
              {['en', 'es'].map((l) => (
                <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l}
                  className={`px-2 py-1 rounded ${lang === l ? 'bg-white text-violet-700' : 'text-violet-100 hover:text-white'}`}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </header>

          <nav className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-4 py-2" aria-label="Acciones">
            <button onClick={newBatch} title={t('newTitle')} className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200">
              <Eraser size={14} /> {t('new')}
            </button>
            <button onClick={() => { setShowHistory(true); refresh(); }} className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200">
              <Clock size={14} /> {t('hist.btn')}
            </button>
            <button onClick={onOpenIngredients} title={t('ing.openTitle')} className="ml-auto flex items-center gap-1.5 rounded-md bg-violet-100 px-2.5 py-1.5 text-xs font-bold text-violet-700 hover:bg-violet-200">
              <Tag size={14} /> {t('ing.open')}
            </button>
            <button onClick={() => setShowSettings(true)} className=" flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200">
              <Cog size={14} /> {t('settings.btn')}
            </button>
          </nav>

          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5" onKeyDown={onEnterNext}>
            <Section title={t('sec.batch')} action={
              <button onClick={nextBatch} disabled={atLastBatch} title={atLastBatch ? t('nextBatchLast') : t('nextBatchTitle')}
                className="flex items-center gap-1 rounded-md bg-violet-100 px-2 py-1 text-[11px] font-bold normal-case tracking-normal text-violet-700 hover:bg-violet-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-violet-100">
                <ChevronsRight size={13} /> {t('nextBatch')}
              </button>
            }>
              <div className="grid gap-3">
                <Labeled label={t('lbl.formula')}>
                  <input
                    name="formula" list="formula-list" value={data.formula} maxLength={LIMITS.formula} autoFocus
                    onChange={(e) => applyFormula(e.target.value.slice(0, LIMITS.formula))} placeholder="300909" className={inputCls}
                  />
                </Labeled>
                <datalist id="formula-list">
                  {formulas.filter((f) => f.formula).map((f, i) => <option key={i} value={f.formula}>{f.name}</option>)}
                </datalist>
                {limited('name', t('lbl.name'))}
                {serverError && (
                  <div role="alert" className="lm-slide flex items-start gap-2 rounded-md border-l-4 border-rose-600 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-900">
                    <AlertTriangle size={16} className="shrink-0 text-rose-600" /> <span className="break-words">{serverError}</span>
                  </div>
                )}
                {canSaveFormula && (
                  <button onClick={saveFormula} className="flex items-center gap-1.5 text-xs font-bold text-violet-700 hover:underline justify-self-start">
                    <BookmarkPlus size={14} /> {saved ? t('updateName') : t('saveFormula')}
                  </button>
                )}
                {statusObj && (
                  <div role={statusObj.type === 'error' ? 'alert' : 'status'}
                    className={`lm-slide flex items-start gap-2 rounded-md border-l-4 px-3 py-2 text-xs font-bold ${
                      statusObj.type === 'error' ? 'bg-rose-50 border-rose-600 text-rose-900'
                        : statusObj.type === 'success' ? 'bg-emerald-50 border-emerald-600 text-emerald-900'
                        : 'bg-amber-50 border-amber-500 text-amber-900'}`}>
                    {statusObj.type === 'error' ? <AlertTriangle size={16} className="shrink-0 text-rose-600" />
                      : statusObj.type === 'success' ? <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                      : <Info size={16} className="shrink-0 text-amber-600" />}
                    <span className="flex-1 break-words">{statusObj.text}</span>
                    <button onClick={() => setStatus('')} aria-label="×" className="shrink-0 opacity-60 hover:opacity-100"><X size={14} /></button>
                  </div>
                )}
                <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                  <Labeled label={t('lbl.batch')}>{text('batch', '3', batchOverTotal ? '!border-rose-500 !bg-rose-50' : '')}</Labeled>
                  <span className="pb-2 text-sm font-extrabold text-slate-400">/</span>
                  <Labeled label={t('lbl.total')}>
                    {text('batchTotal', '12', `${data.batchesCustom ? 'opacity-50' : ''} ${batchOverTotal ? '!border-rose-500 !bg-rose-50' : ''}`, { inputMode: 'numeric' })}
                  </Labeled>
                </div>
                <div className="-mt-1.5 flex items-center gap-2 text-xs">
                  {data.batchesCustom ? (
                    <input name="batches" value={data.batches} maxLength={LIMITS.batches} onChange={onChange} placeholder={t('batches.customPh')} className={`${inputCls} !py-1.5`} />
                  ) : (
                    <p className="flex-1 font-semibold text-slate-500">
                      Batches: <span className="font-extrabold text-slate-900">{batchesText(data) || '—'}</span>
                    </p>
                  )}
                  <button onClick={toggleCustomBatches} className="shrink-0 font-bold text-violet-700 hover:underline">
                    {data.batchesCustom ? t('batches.auto') : t('batches.custom')}
                  </button>
                </div>
                {limited('po', t('lbl.po'), '26101885-1')}
                <div className="grid grid-cols-2 gap-2">
                  <Labeled label={t('lbl.date')}>
                    <div className="relative">
                      {text('date', 'MM/DD/YY', 'pr-14')}
                      {data.date !== todayStr() && (
                        <button onClick={setToday} title={t('todayTitle')} className="absolute right-1.5 top-1.5 px-2 py-1 rounded bg-violet-100 text-violet-700 text-xs font-bold hover:bg-violet-200">{t('today')}</button>
                      )}
                    </div>
                  </Labeled>
                  <Labeled label={t('lbl.id')}>
                    <div className="flex items-center border border-slate-300 rounded-md bg-white focus-within:ring-2 focus-within:ring-violet-500 focus-within:border-violet-500">
                      <span className="pl-3 text-sm font-extrabold text-slate-400 select-none">ID-</span>
                      <input ref={idInput} name="identifier" value={stripId(data.identifier)} maxLength={LIMITS.identifier + 3}
                        onChange={(e) => set('identifier', stripId(e.target.value).slice(0, LIMITS.identifier))} placeholder="G9FB71"
                        className="w-full px-1.5 py-2 text-sm font-semibold text-slate-900 bg-transparent outline-none" />
                    </div>
                  </Labeled>
                </div>
                {(idUse.clash || idUse.again) && (
                  <p role={idUse.clash ? 'alert' : 'status'} className={`-mt-1.5 flex items-start gap-1.5 rounded-md border-l-4 px-3 py-2 text-xs font-bold ${
                    idUse.clash ? 'border-rose-600 bg-rose-50 text-rose-900' : 'border-amber-500 bg-amber-50 text-amber-900'}`}>
                    {idUse.clash ? <AlertTriangle size={14} className="mt-px shrink-0 text-rose-600" /> : <Info size={14} className="mt-px shrink-0 text-amber-600" />}
                    {idUse.clash
                      ? t('id.clash', { id: `ID-${stripId(data.identifier)}`, f: idUse.clash.formula, b: idUse.clash.batch || '—', d: fmtStamp(idUse.clash.ts).d })
                      : t('id.again', { d: fmtStamp(idUse.again.ts).d })}
                  </p>
                )}
                <Labeled label={t('lbl.ile')}>{text('ile', 'ILE')}</Labeled>
              </div>
            </Section>

            <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{t('sec.pallets')} <span className="font-semibold normal-case tracking-normal text-slate-400">· {t('pallets.max', { n: MAX_PALLETS })}</span></h2>
              <div className="flex items-center gap-1" role="group" aria-label={t('sec.pallets')}>
                <button onClick={() => setJob((j) => ({ ...j, pallets: Math.max(1, j.pallets - 1) }))} disabled={job.pallets <= 1} aria-label="−"
                  className="rounded border border-slate-300 bg-white p-1 hover:bg-slate-100 disabled:opacity-40"><Minus size={12} /></button>
                <input type="number" min={1} max={MAX_PALLETS} value={job.pallets} aria-label={t('sec.pallets')}
                  onChange={(e) => setJob((j) => ({ ...j, pallets: Math.min(MAX_PALLETS, Math.max(1, parseInt(e.target.value, 10) || 1)) }))}
                  className="w-10 rounded border border-slate-300 py-0.5 text-center text-sm font-extrabold text-violet-700" />
                <button onClick={() => setJob((j) => ({ ...j, pallets: Math.min(MAX_PALLETS, j.pallets + 1) }))} disabled={job.pallets >= MAX_PALLETS} aria-label="+"
                  className="rounded border border-slate-300 bg-white p-1 hover:bg-slate-100 disabled:opacity-40"><Plus size={12} /></button>
              </div>
            </div>

            <Section title={t('sec.missing')}>
              <label className="flex items-center gap-2 text-sm font-semibold mb-2 cursor-pointer">
                <input type="checkbox" checked={job.withMissing} onChange={(e) => setJob((j) => ({ ...j, withMissing: e.target.checked }))} className="w-4 h-4 accent-rose-600" />
                {t('job.missing')}
              </label>
              {job.withMissing && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200">
                  <ListField name="missing" value={data.missing} onChange={(v) => set('missing', v)} limits={LIMITS.missing} tone="rose"
                    placeholder={t('list.hint', { example: '701360 Pure Vanilla Ext 2' })} />
                </div>
              )}
            </Section>

            <Section title={t('sec.refer')}>
              <label className="flex items-center gap-2 text-sm font-semibold mb-2 cursor-pointer">
                <input type="checkbox" checked={job.withRefer} onChange={(e) => setJob((j) => ({ ...j, withRefer: e.target.checked }))} className="w-4 h-4 accent-sky-600" />
                {t('job.refer')}
              </label>
              {job.withRefer && (
                <div className="p-3 rounded-lg bg-sky-50 border border-sky-200">
                  <ListField name="refer" value={data.refer} onChange={(v) => set('refer', v)} limits={LIMITS.refer} tone="sky"
                    placeholder={t('list.hint', { example: '702757 Chiber Mushroom' })} />
                </div>
              )}
            </Section>
          </div>

          <footer className="p-5 border-t border-slate-200 bg-slate-50 flex flex-col gap-3">
            {batchOverTotal && (
              <p role="alert" className="flex items-start gap-1.5 rounded-md border-l-4 border-rose-600 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-900">
                <AlertTriangle size={14} className="mt-px shrink-0 text-rose-600" /> {t('batches.over', { b: data.batch, t: data.batchTotal })}
              </p>
            )}
            {emptyFields.length > 0 && (
              <p className="text-xs font-semibold text-amber-700">{t('empty.prefix', { list: emptyFields.join(', ') })}</p>
            )}
            <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <span className="mr-auto">{t('copies')}</span>
              <button onClick={() => setJob((j) => ({ ...j, copies: Math.max(1, copies - 1) }))} aria-label="−" className="rounded-md border border-slate-300 bg-white p-1.5 hover:bg-slate-100"><Minus size={12} /></button>
              <span className="w-5 text-center text-sm font-extrabold text-slate-900">{copies}</span>
              <button onClick={() => setJob((j) => ({ ...j, copies: Math.min(3, copies + 1) }))} aria-label="+" className="rounded-md border border-slate-300 bg-white p-1.5 hover:bg-slate-100"><Plus size={12} /></button>
            </div>
            <button onClick={() => printSet()} disabled={totalSheets === 0} className="w-full bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 text-white font-extrabold py-3.5 rounded-lg flex items-center justify-center gap-2 shadow-md transition-colors">
              <Printer size={20} /> {totalSheets === 0 ? t('sel.none') : totalSheets === 1 ? t('print.one') : t('print.many', { n: totalSheets })}
            </button>
            {sheets.length > 1 && (
              <button onClick={() => setShowPick(true)} className={`text-center text-xs font-bold hover:underline ${partial ? 'text-violet-700' : 'text-slate-500'}`}>
                {partial ? t('sel.partial', { a: included.length, b: sheets.length }) : t('sel.allLink')}
              </button>
            )}
            <p className="text-center text-[11px] font-semibold text-slate-400">{t('credit')}</p>
          </footer>
        </aside>

        {/* VISTA PREVIA */}
        <main ref={wrapRef} className="flex-1 overflow-auto">
          {sheets.length > 1 && (
            <div className="sticky top-0 z-10 flex gap-1.5 overflow-x-auto border-b border-slate-200 bg-slate-100/95 px-8 py-2 backdrop-blur" role="navigation" aria-label="Hojas">
              {sheets.length > 10 && (
                <select aria-label={t('jump')} value="" onChange={(e) => e.target.value && document.getElementById(`sheet-${e.target.value}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className="shrink-0 rounded-full border border-slate-300 bg-white px-2 py-1 text-xs font-bold text-slate-600">
                  <option value="">{t('jump')}</option>
                  {sheets.map(({ key, label }) => <option key={key} value={key}>{t(label[0], label[1])}</option>)}
                </select>
              )}
              {sheets.length <= 10 && sheets.map(({ key, short }) => (
                <button key={key} onClick={() => document.getElementById(`sheet-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className="shrink-0 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-600 hover:border-violet-400 hover:text-violet-700">
                  {t(short[0], short[1])}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-col items-center gap-8 p-8">
            {sheets.map(({ key, label, Comp, data: d }) => (
              <div key={key} id={`sheet-${key}`} className="shrink-0 scroll-mt-16">
                <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                  {t(label[0], label[1])}
                  {excluded.includes(key) && <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] normal-case text-slate-600">{t('sel.skipped')}</span>}
                </p>
                <div style={{ width: LABEL_W * scale, height: LABEL_H * scale }} className={`shadow-xl bg-white transition-opacity ${excluded.includes(key) ? 'opacity-40' : ''}`}>
                  <div style={{ width: LABEL_W, height: LABEL_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                    <Comp data={d} logo={logo} onLogoClick={() => setShowSettings(true)} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>

      {showSettings && (
        <SettingsModal
          formulasCount={formulas.length} onOpenFormulas={() => { setShowSettings(false); setShowFormulas(true); }}
          logo={logo} onLogoFile={changeLogo} onRemoveLogo={removeLogo}
          by={by} onBy={setBy} stamp={stamp} onStamp={setStamp} onClose={() => setShowSettings(false)}
        />
      )}
      {showFormulas && (
        <FormulaManager formulas={formulas} onSave={saveEntry} onDelete={deleteEntry} onImport={importEntries} onClose={() => setShowFormulas(false)} />
      )}
      {showHistory && <HistoryModal history={history} error={historyError} onLoad={loadFromHistory} onClose={() => setShowHistory(false)} />}
      {showPick && (
        <Modal onClose={() => setShowPick(false)} className="max-w-md" labelledBy="pick-title">
          <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 id="pick-title" className="text-lg font-extrabold">{t('sel.title')}</h2>
            {partial && <button onClick={resetSelection} className="text-xs font-bold text-violet-700 hover:underline">{t('sel.all')}</button>}
          </header>
          <div className="grid gap-4 overflow-y-auto p-5">
            <div className="flex flex-wrap gap-1.5">
              {[['pre', 'sel.pre'], ['mis', 'sel.mis'], ['ref1', 'sel.ref1'], ['ref2', 'sel.ref2']].map(([ty, lbl]) => {
                const keys = sheets.filter((x) => typeOf(x.key) === ty);
                if (!keys.length) return null;
                const on = keys.filter((x) => !excluded.includes(x.key)).length;
                return (
                  <button key={ty} onClick={() => toggleType(ty)} aria-pressed={on > 0}
                    className={`rounded-full border px-3 py-1 text-xs font-bold ${on === keys.length ? 'border-violet-500 bg-violet-50 text-violet-800' : on ? 'border-violet-300 bg-white text-violet-700' : 'border-slate-300 bg-white text-slate-400 line-through'}`}>
                    {t(lbl)}{keys.length > 1 ? ` ${on}/${keys.length}` : ''}
                  </button>
                );
              })}
            </div>
            {job.pallets > 1 && (
              <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                <span className="shrink-0">{t('sel.pallets')}</span>
                <input value={palletFilter} onChange={(e) => applyPalletFilter(e.target.value)} placeholder={t('sel.palletsHint')}
                  className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm font-semibold" />
              </label>
            )}
            <ul className="grid max-h-64 gap-0.5 overflow-y-auto">
              {sheets.map(({ key, label }) => (
                <li key={key}>
                  <label className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 text-sm font-semibold hover:bg-slate-50">
                    <input type="checkbox" checked={!excluded.includes(key)} onChange={() => toggleSheet(key)} className="h-4 w-4 accent-violet-600" />
                    {t(label[0], label[1])}
                  </label>
                </li>
              ))}
            </ul>
          </div>
          <footer className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3">
            <span className="text-xs font-bold text-slate-500">{t('sel.of', { a: included.length, b: sheets.length })}</span>
            <button autoFocus onClick={() => setShowPick(false)} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-violet-700">{t('sel.done')}</button>
          </footer>
        </Modal>
      )}
      {confirmChecks && <PrintConfirm checks={confirmChecks} total={totalSheets} breakdown={breakdown} onFix={() => setConfirmChecks(null)} onPrint={doPrint} />}
      <div className="app-root"><Toast toast={toast} onUndo={() => toast?.undo && restore(toast.undo)} /></div>

      {/* SALIDA DE IMPRESIÓN: una hoja Letter horizontal por etiqueta (y por copia) */}
      <div className="print-root">
        {Array.from({ length: copies }).flatMap((_, c) =>
          included.map(({ key, Comp, data: d }) => (
            <div key={`${c}-${key}`} className="sheet">
              <div style={{ position: 'relative', width: LABEL_W, height: LABEL_H }}>
                <Comp data={d} logo={logo} />
                {stamp && printedAt && (() => {
                  const { d: day, h } = fmtStamp(printedAt);
                  return <div className="print-stamp">{t('stamp', { d: day, h })}{by ? ` · ${by}` : ''}</div>;
                })()}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
