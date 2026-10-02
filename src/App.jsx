import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, BookmarkPlus, CheckCircle2, Info, X, Eraser, ImagePlus, ListChecks, Printer } from 'lucide-react';
import { useLang } from './i18n.js';
import FormulaManager from './FormulaManager.jsx';
import { deleteLogo, fetchFormulas, fetchLogo, shrinkImage, uploadLogo, writeFormulas } from './api.js';
import { LABEL_H, LABEL_W, batchesText, buildSheets, stripId, toItems } from './Labels.jsx';

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

function Section({ title, children }) {
  return (
    <section>
      <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">{title}</h2>
      {children}
    </section>
  );
}

export default function App() {
  const { lang, setLang, t } = useLang();
  const [data, setData] = useState(() => ({ ...EMPTY, ...load('lm.data', {}), date: todayStr() }));
  const [job, setJob] = useState(() => ({ pallets: 1, withMissing: false, withRefer: false, ...load('lm.job', {}) }));
  const [formulas, setFormulas] = useState([]);
  const [showFormulas, setShowFormulas] = useState(false);
  const [logo, setLogo] = useState(null);
  const [statusObj, setStatusObj] = useState(null); // { text, type: 'info' | 'success' | 'error' }
  const setStatus = (text, type = 'info') => setStatusObj(text ? { text, type } : null);
  const [serverError, setServerError] = useState('');
  const logoInput = useRef(null);

  useEffect(() => save('lm.data', { ...data, date: '' }), [data]);
  useEffect(() => save('lm.job', job), [job]);

  const sheets = useMemo(() => buildSheets(data, job), [data, job]);

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
    if (e.target.name === 'date') dateEdited.current = true;
    set(e.target.name, e.target.value);
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
  const onLogo = (e) => {
    const file = e.target.files?.[0];
    if (file) changeLogo(file);
    e.target.value = '';
  };

  // Al imprimir, si la fórmula es nueva se agrega sola a la lista compartida.
  const printSet = async () => {
    if (trimmedFormula && norm(data.name) && !saved) {
      try { setFormulas(await writeFormulas('add', [entryFromForm()])); } catch { /* imprimir igual */ }
    }
    window.print();
  };

  // Pasar a texto manual parte del valor automático ("3/12") para poder editarlo; volver a automático lo descarta.
  const toggleCustomBatches = () =>
    setData((d) => (d.batchesCustom ? { ...d, batchesCustom: false } : { ...d, batchesCustom: true, batches: batchesText(d) }));

  const newBatch = () =>
    setData((d) => ({ ...EMPTY, date: dateEdited.current ? d.date : todayStr(), ile: d.ile }));

  const required = {
    formula: 'Formula', name: 'Name', batch: 'Batch#', po: 'P.O.#', batches: 'Batches', identifier: 'ID',
  };
  const effective = { ...data, batches: batchesText(data) };
  const emptyFields = Object.entries(required).filter(([k]) => !norm(effective[k])).map(([, l]) => l);
  if (job.withMissing && !toItems(data.missing).length) emptyFields.push(t('empty.missing'));
  if (job.withRefer && !toItems(data.refer).length) emptyFields.push(t('empty.refer'));

  const text = (name, placeholder, extra = '') => (
    <input key={name} name={name} value={data[name]} onChange={onChange} placeholder={placeholder} className={`${inputCls} ${extra}`} />
  );

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
            <button onClick={newBatch} title={t('newTitle')} className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-white/15 hover:bg-white/25 text-xs font-bold">
              <Eraser size={14} /> {t('new')}
            </button>
          </header>

          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
            <Section title={t('sec.batch')}>
              <div className="grid gap-2">
                <input
                  name="formula" list="formula-list" value={data.formula}
                  onChange={(e) => applyFormula(e.target.value)} placeholder={t('ph.formula')} className={inputCls}
                />
                <datalist id="formula-list">
                  {formulas.filter((f) => f.formula).map((f, i) => <option key={i} value={f.formula}>{f.name}</option>)}
                </datalist>
                {text('name', 'Name')}
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
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  {text('batch', 'Batch#')}
                  <span className="text-sm font-extrabold text-slate-400">/</span>
                  {text('batchTotal', t('ph.batchTotal'), data.batchesCustom ? 'opacity-50' : '')}
                </div>
                <div className="-mt-1 flex items-center gap-2 text-xs">
                  {data.batchesCustom ? (
                    <input name="batches" value={data.batches} onChange={onChange} placeholder={t('batches.customPh')} className={`${inputCls} !py-1.5`} />
                  ) : (
                    <p className="flex-1 font-semibold text-slate-500">
                      Batches: <span className="font-extrabold text-slate-900">{batchesText(data) || '—'}</span>
                    </p>
                  )}
                  <button onClick={toggleCustomBatches} className="shrink-0 font-bold text-violet-700 hover:underline">
                    {data.batchesCustom ? t('batches.auto') : t('batches.custom')}
                  </button>
                </div>
                {text('po', 'P.O.#')}
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    {text('date', t('ph.date'), 'pr-14')}
                    {data.date !== todayStr() && (
                      <button onClick={setToday} title={t('todayTitle')} className="absolute right-1.5 top-1.5 px-2 py-1 rounded bg-violet-100 text-violet-700 text-xs font-bold hover:bg-violet-200">{t('today')}</button>
                    )}
                  </div>
                  <div className="flex items-center border border-slate-300 rounded-md bg-white focus-within:ring-2 focus-within:ring-violet-500 focus-within:border-violet-500">
                    <span className="pl-3 text-sm font-extrabold text-slate-400 select-none">ID-</span>
                    <input name="identifier" value={stripId(data.identifier)} onChange={(e) => set('identifier', stripId(e.target.value))} placeholder="G9FB71" className="w-full px-1.5 py-2 text-sm font-semibold text-slate-900 bg-transparent outline-none" />
                  </div>
                </div>
                {text('ile', 'ILE')}
              </div>
            </Section>

            <Section title={t('sec.pallets')}>
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
                {[1, 2, 3].map((n) => (
                  <button
                    key={n}
                    onClick={() => setJob((j) => ({ ...j, pallets: n }))}
                    className={`py-2 rounded-md text-sm font-extrabold transition-colors ${
                      job.pallets === n ? 'bg-white shadow text-violet-700' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {n} {n === 1 ? 'pallet' : 'pallets'}
                  </button>
                ))}
              </div>
            </Section>

            <Section title={t('sec.missing')}>
              <label className="flex items-center gap-2 text-sm font-semibold mb-2 cursor-pointer">
                <input type="checkbox" checked={job.withMissing} onChange={(e) => setJob((j) => ({ ...j, withMissing: e.target.checked }))} className="w-4 h-4 accent-rose-600" />
                {t('job.missing')}
              </label>
              {job.withMissing && (
                <div className="grid gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200">
                  <textarea name="missing" value={data.missing} onChange={onChange} rows={5} placeholder={t('list.hint', { example: '701360 Pure Vanilla Ext 2' })} className={`${inputCls} resize-y`} />
                  <p className="text-xs text-rose-700">{t('list.count', { n: toItems(data.missing).length })}</p>
                </div>
              )}
            </Section>

            <Section title={t('sec.refer')}>
              <label className="flex items-center gap-2 text-sm font-semibold mb-2 cursor-pointer">
                <input type="checkbox" checked={job.withRefer} onChange={(e) => setJob((j) => ({ ...j, withRefer: e.target.checked }))} className="w-4 h-4 accent-sky-600" />
                {t('job.refer')}
              </label>
              {job.withRefer && (
                <div className="grid gap-2 p-3 rounded-lg bg-sky-50 border border-sky-200">
                  <textarea name="refer" value={data.refer} onChange={onChange} rows={5} placeholder={t('list.hint', { example: '702757 Chiber Mushroom' })} className={`${inputCls} resize-y`} />
                  <p className="text-xs text-sky-700">{t('list.count', { n: toItems(data.refer).length })}</p>
                </div>
              )}
            </Section>

            <Section title={t('sec.formulas')}>
              <button onClick={() => setShowFormulas(true)} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-md border border-slate-300 hover:border-violet-400 hover:bg-violet-50 text-sm font-semibold text-slate-700">
                <ListChecks size={18} />
                <span className="flex-1 text-left">{t('manage')}</span>
                <span className="text-xs text-slate-500">{formulas.length}</span>
              </button>
            </Section>

            <Section title={t('sec.logo')}>
              <input ref={logoInput} type="file" accept="image/*" onChange={onLogo} className="hidden" />
              <div className="flex gap-2">
                <button onClick={() => logoInput.current?.click()} className="flex items-center gap-2 px-3 py-2 rounded-md bg-slate-100 hover:bg-slate-200 text-sm font-semibold">
                  <ImagePlus size={16} /> {logo ? t('logo.change') : t('logo.upload')}
                </button>
                {logo && (
                  <button onClick={removeLogo} className="px-3 py-2 rounded-md text-sm font-semibold text-slate-500 hover:bg-slate-100">
                    {t('remove')}
                  </button>
                )}
              </div>
            </Section>
          </div>

          <footer className="p-5 border-t border-slate-200 bg-slate-50 flex flex-col gap-3">
            {emptyFields.length > 0 && (
              <p className="text-xs font-semibold text-amber-700">{t('empty.prefix', { list: emptyFields.join(', ') })}</p>
            )}
            <button onClick={() => printSet()} className="w-full bg-violet-600 hover:bg-violet-700 text-white font-extrabold py-3.5 rounded-lg flex items-center justify-center gap-2 shadow-md transition-colors">
              <Printer size={20} /> {sheets.length === 1 ? t('print.one') : t('print.many', { n: sheets.length })}
            </button>
            <p className="text-center text-[11px] font-semibold text-slate-400">{t('credit')}</p>
          </footer>
        </aside>

        {/* VISTA PREVIA */}
        <main ref={wrapRef} className="flex-1 overflow-auto p-8 flex flex-col items-center gap-8">
          {sheets.map(({ key, label, Comp, data: d }) => (
            <div key={key} className="shrink-0">
              <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">{t(label[0], label[1])}</p>
              <div style={{ width: LABEL_W * scale, height: LABEL_H * scale }} className="shadow-xl bg-white">
                <div style={{ width: LABEL_W, height: LABEL_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                  <Comp data={d} logo={logo} onLogoClick={() => logoInput.current?.click()} />
                </div>
              </div>
            </div>
          ))}
        </main>
      </div>

      {showFormulas && (
        <FormulaManager formulas={formulas} onSave={saveEntry} onDelete={deleteEntry} onImport={importEntries} onClose={() => setShowFormulas(false)} />
      )}

      {/* SALIDA DE IMPRESIÓN: una hoja Letter horizontal por etiqueta */}
      <div className="print-root">
        {sheets.map(({ key, Comp, data: d }) => (
          <div key={key} className="sheet">
            <Comp data={d} logo={logo} />
          </div>
        ))}
      </div>
    </>
  );
}
