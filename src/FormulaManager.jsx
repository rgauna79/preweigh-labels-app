import React, { useMemo, useState } from 'react';
import { Download, Plus, RotateCcw, Search, Trash2, Upload, X } from 'lucide-react';
import { downloadText, formulasToCsv, parseFormulasCsv } from './formulas.js';

const cell =
  'w-full px-2.5 py-1.5 border border-transparent hover:border-slate-300 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 rounded-md bg-transparent text-sm font-semibold outline-none';

/** Ventana para agregar, editar y borrar fórmulas (código + nombre). */
export default function FormulaManager({ formulas, onChange, onReset, onClose }) {
  const [query, setQuery] = useState('');
  const [msg, setMsg] = useState('');

  const q = query.trim().toLowerCase();
  // Se conserva el índice real para poder editar la fila correcta aunque haya filtro.
  const rows = useMemo(
    () =>
      formulas
        .map((f, i) => ({ f, i }))
        .filter(({ f }) => !q || f.formula.toLowerCase().includes(q) || f.name.toLowerCase().includes(q)),
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

  const update = (i, patch) => onChange(formulas.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const remove = (i) => onChange(formulas.filter((_, j) => j !== i));
  const add = () => {
    setQuery('');
    onChange([{ formula: '', name: '', ile: '' }, ...formulas]);
  };

  const importCsv = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    parseFormulasCsv(file, (list) => {
      if (!list.length) return setMsg('No se encontraron fórmulas. El CSV necesita las columnas Formula y Name.');
      // Las del CSV actualizan las existentes por código y agregan las nuevas.
      const map = new Map(formulas.map((f) => [f.formula.toLowerCase(), f]));
      list.forEach((f) => map.set(f.formula.toLowerCase(), f));
      onChange([...map.values()]);
      setMsg(`${list.length} fórmulas importadas.`);
    });
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-full flex flex-col" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center gap-3 px-5 py-4 border-b border-slate-200">
          <h2 className="text-lg font-extrabold flex-1">Fórmulas ({formulas.length})</h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-slate-100" aria-label="Cerrar"><X size={18} /></button>
        </header>

        <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-slate-100">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={15} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar código o nombre"
              className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          <button onClick={add} className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold">
            <Plus size={15} /> Agregar
          </button>
          <label className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-slate-100 hover:bg-slate-200 text-sm font-semibold cursor-pointer">
            <Upload size={15} /> Importar CSV
            <input type="file" accept=".csv,text/csv" onChange={importCsv} className="hidden" />
          </label>
          <button onClick={() => downloadText('formulas.csv', formulasToCsv(formulas))} className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-slate-100 hover:bg-slate-200 text-sm font-semibold">
            <Download size={15} /> Exportar
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-3 py-2">
          <div className="grid grid-cols-[130px_1fr_36px] gap-1 px-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <span>Fórmula</span><span>Nombre</span><span />
          </div>
          {rows.map(({ f, i }) => (
            <div key={i} className="grid grid-cols-[130px_1fr_36px] gap-1 items-center">
              <input
                value={f.formula} onChange={(e) => update(i, { formula: e.target.value })} placeholder="300909"
                className={`${cell} ${duplicates.has(f.formula.trim().toLowerCase()) ? '!border-amber-400 bg-amber-50' : ''}`}
                title={duplicates.has(f.formula.trim().toLowerCase()) ? 'Código repetido' : undefined}
              />
              <input value={f.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="Nombre del producto" className={cell} />
              <button onClick={() => remove(i)} className="p-2 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50" aria-label="Borrar fórmula">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          {!rows.length && <p className="text-sm text-slate-500 text-center py-10">{formulas.length ? 'Sin resultados.' : 'Aún no hay fórmulas. Usa "Agregar".'}</p>}
        </div>

        <footer className="flex items-center gap-3 px-5 py-3 border-t border-slate-200 text-xs text-slate-500">
          <span className="flex-1">
            {msg || 'Los cambios se guardan automáticamente en este navegador. Usa Exportar para llevarlos a otra computadora.'}
            {duplicates.size > 0 && <span className="text-amber-700 font-semibold"> Hay códigos repetidos.</span>}
          </span>
          <button onClick={() => { if (confirm('¿Descartar tus cambios y volver a la lista original de la app?')) onReset(); }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md hover:bg-slate-100 font-semibold">
            <RotateCcw size={13} /> Restaurar original
          </button>
        </footer>
      </div>
    </div>
  );
}
