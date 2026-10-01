import React, { useEffect, useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import { Download, Eraser, FileSpreadsheet, ImagePlus, Minus, Plus, Printer, SkipForward, Tags } from 'lucide-react';
import { LABEL_H, LABEL_W, getPages } from './Labels.jsx';

const FORMATS = [
  { id: 'preweigh', name: 'Preweigh Pallet Tag' },
  { id: 'missing', name: 'Preweigh Pallet Missing' },
  { id: 'refer', name: 'Keep in Refer' },
];

const REQUIRED = {
  preweigh: { date: 'Fecha', formula: 'Formula', name: 'Name', batch: 'Batch#', po: 'P.O.#', batches: 'Batches' },
  missing: { date: 'Fecha', name: 'Name', batch: 'Batch#', po: 'P.O.#', batches: 'Batches' },
  refer: { name: 'Name', formula: 'Formula', batches: 'Batches' },
};

const EMPTY = {
  date: '', formula: '', name: '', batch: '', po: '', batches: '',
  palletNum: '1', palletTotal: '1', ile: 'ILE', identifier: '',
  missing1: '', missing2: '', missing3: '', missing4: '',
  refer1: '', refer2: '', refer3: '', refer4: '',
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
  const [format, setFormat] = useState(() => load('lm.format', 'preweigh'));
  const [data, setData] = useState(() => ({ ...EMPTY, ...load('lm.data', {}), date: todayStr() }));
  const [formulas, setFormulas] = useState(() => load('lm.formulas', []));
  const [logo, setLogo] = useState(() => load('lm.logo', null));
  const [copies, setCopies] = useState(1);
  const [referPages, setReferPages] = useState('both');
  const [status, setStatus] = useState('');
  const logoInput = useRef(null);

  useEffect(() => save('lm.format', format), [format]);
  useEffect(() => save('lm.data', { ...data, date: '' }), [data]);

  const pages = useMemo(() => getPages(format, data, referPages), [format, data, referPages]);

  // --- Vista previa escalada al ancho disponible ---
  const wrapRef = useRef(null);
  const [scale, setScale] = useState(0.7);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth - 64;
      const h = el.clientHeight - 64;
      setScale(Math.max(0.3, Math.min(1, w / LABEL_W, h / LABEL_H)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const set = (name, value) => setData((d) => ({ ...d, [name]: value }));
  const onChange = (e) => set(e.target.name, e.target.value);

  const norm = (s) => String(s ?? '').trim();

  const applyFormula = (value) => {
    const match = formulas.find((f) => f.formula.toLowerCase() === norm(value).toLowerCase());
    setData((d) => ({
      ...d,
      formula: value,
      ...(match ? { name: match.name || d.name, identifier: match.identifier || d.identifier, ile: match.ile || 'ILE' } : {}),
    }));
    setStatus(
      formulas.length && norm(value) && !match ? `Fórmula "${norm(value)}" no está en la base de datos.` : ''
    );
  };

  const onCsv = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.replace(/^﻿/, '').trim().toLowerCase(),
      complete: ({ data: rows }) => {
        const list = rows
          .map((r) => ({
            formula: norm(r.formula),
            name: norm(r.name),
            identifier: norm(r.identifier ?? r.id),
            ile: norm(r.ile),
          }))
          .filter((r) => r.formula);
        setFormulas(list);
        save('lm.formulas', list);
        setStatus(
          list.length
            ? `${list.length} fórmulas cargadas.`
            : 'No se encontraron fórmulas. El CSV necesita las columnas: Formula, Name, Identifier, ILE.'
        );
      },
    });
    e.target.value = '';
  };

  const onLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setLogo(ev.target.result);
      save('lm.logo', ev.target.result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const nextPallet = () => {
    const n = parseInt(data.palletNum, 10);
    if (!Number.isNaN(n)) set('palletNum', String(n + 1));
  };

  const clearFields = () =>
    setData((d) => ({ ...EMPTY, date: d.date, palletTotal: d.palletTotal, ile: d.ile }));

  const missing = Object.entries(REQUIRED[format]).filter(([k]) => !norm(data[k]));
  const totalSheets = pages.length * copies;

  const sample = 'Formula,Name,Identifier,ILE\n300909,CYBK Women\'s Hormone,ID-G9FB71,ILE\n300888,ANCN Tropical Collagen Gel,ID-CF9DC9,ILE\n';
  const downloadSample = () => {
    const url = URL.createObjectURL(new Blob([sample], { type: 'text/csv' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'formulas-ejemplo.csv' });
    a.click();
    URL.revokeObjectURL(url);
  };

  const text = (name, placeholder, extra = '') => (
    <input key={name} name={name} value={data[name]} onChange={onChange} placeholder={placeholder} className={`${inputCls} ${extra}`} />
  );

  return (
    <>
      <div className="app-root flex h-screen bg-slate-100 font-sans text-slate-900">
        {/* PANEL DE DATOS */}
        <aside className="w-[380px] shrink-0 bg-white border-r border-slate-200 flex flex-col">
          <header className="px-5 py-4 bg-violet-600 text-white flex items-center gap-3">
            <Tags size={26} />
            <div>
              <h1 className="text-lg font-extrabold leading-tight">Label Master</h1>
              <p className="text-xs text-violet-200">Pre-weigh tags</p>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
            <Section title="Formato">
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
                {FORMATS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFormat(f.id)}
                    className={`py-2 px-1 rounded-md text-xs font-bold leading-tight transition-colors ${
                      format === f.id ? 'bg-white shadow text-violet-700' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </Section>

            <Section title="Datos">
              <div className="grid gap-2">
                {format !== 'missing' && (
                  <>
                    <input
                      name="formula"
                      list="formula-list"
                      value={data.formula}
                      onChange={(e) => applyFormula(e.target.value)}
                      placeholder="Formula (ej. 300909)"
                      className={inputCls}
                    />
                    <datalist id="formula-list">
                      {formulas.map((f) => (
                        <option key={f.formula} value={f.formula}>{f.name}</option>
                      ))}
                    </datalist>
                  </>
                )}
                {text('name', 'Name')}
                {format !== 'refer' && (
                  <div className="grid grid-cols-2 gap-2">
                    {text('date', 'Fecha MM/DD/YY')}
                    {text('batch', 'Batch#')}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {text('batches', 'Batches (ej. 3/19)')}
                  {format !== 'refer' && text('po', 'P.O.#')}
                </div>
                {format !== 'refer' && (
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                    Pallet
                    <input name="palletNum" value={data.palletNum} onChange={onChange} className={`${inputCls} !w-14 text-center`} />
                    de
                    <input name="palletTotal" value={data.palletTotal} onChange={onChange} className={`${inputCls} !w-14 text-center`} />
                    <button onClick={nextPallet} title="Siguiente pallet" className="ml-auto flex items-center gap-1 px-2.5 py-2 rounded-md bg-slate-100 hover:bg-slate-200 text-xs font-bold">
                      <SkipForward size={14} /> Siguiente
                    </button>
                  </div>
                )}
                {format === 'preweigh' && (
                  <div className="grid grid-cols-2 gap-2">
                    {text('ile', 'ILE')}
                    {text('identifier', 'ID-XXXXXX')}
                  </div>
                )}
                {format === 'refer' && (
                  <div className="grid grid-cols-2 gap-2">
                    {text('ile', 'ILE')}
                    {text('identifier', 'ID-XXXXXX')}
                  </div>
                )}
              </div>
            </Section>

            {format === 'missing' && (
              <Section title="Ingredientes faltantes">
                <div className="grid gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200">
                  {[1, 2, 3, 4].map((n) => text(`missing${n}`, `Missing ${n}`))}
                </div>
              </Section>
            )}

            {format === 'refer' && (
              <Section title="Ingredientes refrigerados">
                <div className="grid gap-2 p-3 rounded-lg bg-sky-50 border border-sky-200">
                  {[1, 2, 3, 4].map((n) => text(`refer${n}`, `Refer ${n}`))}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg text-xs font-bold">
                  {[['both', '2 páginas'], ['1', 'Solo KEEP'], ['2', 'Solo ITEMS']].map(([v, l]) => (
                    <button key={v} onClick={() => setReferPages(v)} className={`py-1.5 rounded-md ${referPages === v ? 'bg-white shadow text-violet-700' : 'text-slate-500'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </Section>
            )}

            <Section title="Base de datos de fórmulas (CSV)">
              <label className="flex items-center gap-2 px-3 py-2.5 rounded-md border border-dashed border-slate-300 hover:border-violet-400 hover:bg-violet-50 cursor-pointer text-sm font-semibold text-slate-600">
                <FileSpreadsheet size={18} />
                <span className="flex-1">{formulas.length ? `${formulas.length} fórmulas cargadas` : 'Cargar archivo CSV'}</span>
                <input type="file" accept=".csv,text/csv" onChange={onCsv} className="hidden" />
              </label>
              <button onClick={downloadSample} className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-violet-600 hover:underline">
                <Download size={12} /> Descargar CSV de ejemplo
              </button>
              {status && <p className="mt-1.5 text-xs font-semibold text-amber-700">{status}</p>}
            </Section>

            {format === 'preweigh' && (
              <Section title="Logo">
                <input ref={logoInput} type="file" accept="image/*" onChange={onLogo} className="hidden" />
                <div className="flex gap-2">
                  <button onClick={() => logoInput.current?.click()} className="flex items-center gap-2 px-3 py-2 rounded-md bg-slate-100 hover:bg-slate-200 text-sm font-semibold">
                    <ImagePlus size={16} /> {logo ? 'Cambiar logo' : 'Subir logo'}
                  </button>
                  {logo && (
                    <button onClick={() => { setLogo(null); save('lm.logo', null); }} className="px-3 py-2 rounded-md text-sm font-semibold text-slate-500 hover:bg-slate-100">
                      Quitar
                    </button>
                  )}
                </div>
              </Section>
            )}
          </div>

          <footer className="p-5 border-t border-slate-200 bg-slate-50 flex flex-col gap-3">
            {missing.length > 0 && (
              <p className="text-xs font-semibold text-amber-700">Vacío: {missing.map(([, l]) => l).join(', ')}</p>
            )}
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-600 mr-auto">Copias</span>
              <button onClick={() => setCopies((c) => Math.max(1, c - 1))} className="p-2 rounded-md bg-white border border-slate-300 hover:bg-slate-100" aria-label="Menos copias"><Minus size={14} /></button>
              <span className="w-8 text-center font-extrabold">{copies}</span>
              <button onClick={() => setCopies((c) => Math.min(50, c + 1))} className="p-2 rounded-md bg-white border border-slate-300 hover:bg-slate-100" aria-label="Más copias"><Plus size={14} /></button>
              <button onClick={clearFields} title="Limpiar campos" className="p-2 ml-2 rounded-md bg-white border border-slate-300 hover:bg-slate-100" aria-label="Limpiar campos"><Eraser size={16} /></button>
            </div>
            <button onClick={() => window.print()} className="w-full bg-violet-600 hover:bg-violet-700 text-white font-extrabold py-3.5 rounded-lg flex items-center justify-center gap-2 shadow-md transition-colors">
              <Printer size={20} /> Imprimir {totalSheets} {totalSheets === 1 ? 'hoja' : 'hojas'}
            </button>
          </footer>
        </aside>

        {/* VISTA PREVIA */}
        <main ref={wrapRef} className="flex-1 overflow-auto p-8 flex flex-col items-center gap-8">
          {pages.map((Page, i) => (
            <div key={i} style={{ width: LABEL_W * scale, height: LABEL_H * scale }} className="shrink-0 shadow-xl bg-white">
              <div style={{ width: LABEL_W, height: LABEL_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                <Page data={data} logo={logo} onLogoClick={() => logoInput.current?.click()} />
              </div>
            </div>
          ))}
        </main>
      </div>

      {/* SALIDA DE IMPRESIÓN: una hoja Letter horizontal por etiqueta y copia */}
      <div className="print-root">
        {Array.from({ length: copies }).flatMap((_, c) =>
          pages.map((Page, i) => (
            <div key={`${c}-${i}`} className="sheet">
              <Page data={data} logo={logo} />
            </div>
          ))
        )}
      </div>
    </>
  );
}
