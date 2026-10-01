import React, { useEffect, useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import { Download, Eraser, FileSpreadsheet, ImagePlus, Printer, Tags } from 'lucide-react';
import { LABEL_H, LABEL_W, buildSheets } from './Labels.jsx';

const EMPTY = {
  date: '', formula: '', name: '', batch: '', po: '', batches: '', ile: 'ILE', identifier: '',
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
  const [data, setData] = useState(() => ({ ...EMPTY, ...load('lm.data', {}), date: todayStr() }));
  const [job, setJob] = useState(() => ({ pallets: 1, withMissing: false, withRefer: false, ...load('lm.job', {}) }));
  const [formulas, setFormulas] = useState(() => load('lm.formulas', []));
  const [logo, setLogo] = useState(() => load('lm.logo', null));
  const [status, setStatus] = useState('');
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
  const onChange = (e) => set(e.target.name, e.target.value);

  const norm = (s) => String(s ?? '').trim();

  const applyFormula = (value) => {
    const match = formulas.find((f) => f.formula.toLowerCase() === norm(value).toLowerCase());
    setData((d) => ({
      ...d,
      formula: value,
      ...(match ? { name: match.name || d.name, ile: match.ile || 'ILE' } : {}),
    }));
    setStatus(
      formulas.length && norm(value) && !match ? `Fórmula "${norm(value)}" no está en la base de datos.` : ''
    );
  };

  const parseCsv = (input, onDone) =>
    Papa.parse(input, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.replace(/^\uFEFF/, '').trim().toLowerCase(),
      complete: ({ data: rows }) =>
        onDone(
          rows
            .map((r) => ({ formula: norm(r.formula), name: norm(r.name), ile: norm(r.ile) }))
            .filter((r) => r.formula)
        ),
    });

  const onCsv = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    parseCsv(file, (list) => {
      setFormulas(list);
      save('lm.formulas', list);
      setStatus(
        list.length
          ? `${list.length} fórmulas cargadas (solo en este navegador).`
          : 'No se encontraron fórmulas. El CSV necesita las columnas: Formula, Name (y opcional ILE).'
      );
    });
    e.target.value = '';
  };

  // Archivos compartidos: public/formulas.csv y public/logo.png viajan con la app.
  // Si existen, tienen prioridad sobre lo que cada navegador haya guardado.
  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    fetch(`${base}formulas.csv`, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.text() : Promise.reject()))
      .then((txt) => {
        if (txt.trimStart().startsWith('<')) return; // el servidor devolvió una página HTML, no un CSV
        parseCsv(txt, (list) => list.length && setFormulas(list));
      })
      .catch(() => {});
    fetch(`${base}logo.png`, { cache: 'no-cache' })
      .then((r) => (r.ok && r.headers.get('content-type')?.startsWith('image/') ? r.blob() : Promise.reject()))
      .then((blob) => {
        const reader = new FileReader();
        reader.onload = (ev) => setLogo(ev.target.result);
        reader.readAsDataURL(blob);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const newBatch = () =>
    setData((d) => ({ ...EMPTY, date: d.date, ile: d.ile }));

  const required = {
    formula: 'Formula', name: 'Name', batch: 'Batch#', po: 'P.O.#', batches: 'Batches', identifier: 'ID',
  };
  const emptyFields = Object.entries(required).filter(([k]) => !norm(data[k])).map(([, l]) => l);
  if (job.withMissing && ![1, 2, 3, 4].some((n) => norm(data[`missing${n}`]))) emptyFields.push('Ingredientes faltantes');
  if (job.withRefer && ![1, 2, 3, 4].some((n) => norm(data[`refer${n}`]))) emptyFields.push('Ingredientes refrigerados');

  const sample = 'Formula,Name,ILE\n300909,CYBK Women\'s Hormone,ILE\n300888,ANCN Tropical Collagen Gel,ILE\n';
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
            <div className="flex-1">
              <h1 className="text-lg font-extrabold leading-tight">Label Master</h1>
              <p className="text-xs text-violet-200">Pre-weigh tags</p>
            </div>
            <button onClick={newBatch} title="Nuevo batch (limpia los campos)" className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-white/15 hover:bg-white/25 text-xs font-bold">
              <Eraser size={14} /> Nuevo
            </button>
          </header>

          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
            <Section title="Batch">
              <div className="grid gap-2">
                <input
                  name="formula" list="formula-list" value={data.formula}
                  onChange={(e) => applyFormula(e.target.value)} placeholder="Formula (ej. 300909)" className={inputCls}
                />
                <datalist id="formula-list">
                  {formulas.map((f) => <option key={f.formula} value={f.formula}>{f.name}</option>)}
                </datalist>
                {text('name', 'Name')}
                <div className="grid grid-cols-2 gap-2">
                  {text('batch', 'Batch#')}
                  {text('batches', 'Batches (ej. 3/19)')}
                </div>
                {text('po', 'P.O.#')}
                <div className="grid grid-cols-2 gap-2">
                  {text('date', 'Fecha MM/DD/YY')}
                  {text('identifier', 'ID-XXXXXX')}
                </div>
                {text('ile', 'ILE')}
              </div>
            </Section>

            <Section title="Pallets">
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

            <Section title="Ingredientes faltantes">
              <label className="flex items-center gap-2 text-sm font-semibold mb-2 cursor-pointer">
                <input type="checkbox" checked={job.withMissing} onChange={(e) => setJob((j) => ({ ...j, withMissing: e.target.checked }))} className="w-4 h-4 accent-rose-600" />
                Faltan ingredientes (1 tag Missing por pallet)
              </label>
              {job.withMissing && (
                <div className="grid gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200">
                  {[1, 2, 3, 4].map((n) => text(`missing${n}`, `Missing ${n}`))}
                </div>
              )}
            </Section>

            <Section title="Ingredientes refrigerados">
              <label className="flex items-center gap-2 text-sm font-semibold mb-2 cursor-pointer">
                <input type="checkbox" checked={job.withRefer} onChange={(e) => setJob((j) => ({ ...j, withRefer: e.target.checked }))} className="w-4 h-4 accent-sky-600" />
                Lleva refrigerados (2 hojas Refer)
              </label>
              {job.withRefer && (
                <div className="grid gap-2 p-3 rounded-lg bg-sky-50 border border-sky-200">
                  {[1, 2, 3, 4].map((n) => text(`refer${n}`, `Refer ${n}`))}
                </div>
              )}
            </Section>

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
          </div>

          <footer className="p-5 border-t border-slate-200 bg-slate-50 flex flex-col gap-3">
            {emptyFields.length > 0 && (
              <p className="text-xs font-semibold text-amber-700">Vacío: {emptyFields.join(', ')}</p>
            )}
            <button onClick={() => window.print()} className="w-full bg-violet-600 hover:bg-violet-700 text-white font-extrabold py-3.5 rounded-lg flex items-center justify-center gap-2 shadow-md transition-colors">
              <Printer size={20} /> Imprimir {sheets.length} {sheets.length === 1 ? 'hoja' : 'hojas'}
            </button>
          </footer>
        </aside>

        {/* VISTA PREVIA */}
        <main ref={wrapRef} className="flex-1 overflow-auto p-8 flex flex-col items-center gap-8">
          {sheets.map(({ key, label, Comp, data: d }) => (
            <div key={key} className="shrink-0">
              <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">{label}</p>
              <div style={{ width: LABEL_W * scale, height: LABEL_H * scale }} className="shadow-xl bg-white">
                <div style={{ width: LABEL_W, height: LABEL_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                  <Comp data={d} logo={logo} onLogoClick={() => logoInput.current?.click()} />
                </div>
              </div>
            </div>
          ))}
        </main>
      </div>

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
