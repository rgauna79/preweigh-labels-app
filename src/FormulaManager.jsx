import React, { useMemo, useState } from 'react';
import { Download, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { downloadText, formulasToCsv, parseFormulasCsv } from './formulas.js';

const cell =
  'w-full px-2.5 py-1.5 border border-transparent hover:border-slate-300 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 rounded-md bg-transparent text-sm font-semibold outline-none';

/** Una fila: se edita en local y se guarda en el servidor al salir del campo. */
function Row({ entry, isNew, duplicate, onSave, onDelete, onDiscard }) {
  const [formula, setFormula] = useState(entry.formula);
  const [name, setName] = useState(entry.name);

  const commit = () => {
    const next = { ...entry, formula: formula.trim(), name: name.trim() };
    if (!next.formula) return; // sin código no hay nada que guardar
    if (!isNew && next.formula === entry.formula && next.name === entry.name) return;
    onSave(isNew ? null : entry.formula, next);
  };

  return (
    <div className="grid grid-cols-[130px_1fr_36px] gap-1 items-center">
      <input
        value={formula} onChange={(e) => setFormula(e.target.value)} onBlur={commit} placeholder="300909" autoFocus={isNew}
        className={`${cell} ${duplicate ? '!border-amber-400 bg-amber-50' : ''}`} title={duplicate ? 'Código repetido' : undefined}
      />
      <input value={name} onChange={(e) => setName(e.target.value)} onBlur={commit} placeholder="Nombre del producto" className={cell} />
      <button
        onClick={() => (isNew ? onDiscard() : onDelete(entry.formula))}
        className="p-2 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50" aria-label="Borrar fórmula"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}

/** Ventana compartida para agregar, editar y borrar fórmulas (código + nombre). */
export default function FormulaManager({ formulas, onSave, onDelete, onImport, onClose }) {
  const [query, setQuery] = useState('');
  const [msg, setMsg] = useState('');
  const [adding, setAdding] = useState(false);

  const q = query.trim().toLowerCase();
  const rows = useMemo(
    () => formulas.filter((f) => !q || f.formula.toLowerCase().includes(q) || f.name.toLowerCase().includes(q)),
    [formulas, q]
  );

  const guard = (fn) => async (...args) => {
    try {
      await fn(...args);
      setMsg('Guardado para todos.');
    } catch (err) {
      setMsg(`No se guardó: ${err.message}`);
    }
  };
  const save = guard(async (old, entry) => { await onSave(old, entry); setAdding(false); });
  const remove = guard((code) => {
    if (confirm(`¿Borrar la fórmula ${code} para todos?`)) return onDelete(code);
  });

  const importCsv = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    parseFormulasCsv(file, (list) => {
      if (!list.length) return setMsg('No se encontraron fórmulas. El CSV necesita las columnas Formula y Name.');
      guard(async () => { await onImport(list); setMsg(`${list.length} fórmulas importadas para todos.`); })();
    });
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-full flex flex-col" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center gap-3 px-5 py-4 border-b border-slate-200">
          <h2 className="text-lg font-extrabold flex-1">Fórmulas compartidas ({formulas.length})</h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-slate-100" aria-label="Cerrar"><X size={18} /></button>
        </header>

        <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-slate-100">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={15} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar código o nombre"
              className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          <button onClick={() => { setQuery(''); setAdding(true); }} className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold">
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
          {adding && <Row key="new" isNew entry={{ formula: '', name: '', ile: '' }} onSave={save} onDiscard={() => setAdding(false)} />}
          {rows.map((f) => (
            <Row key={f.formula} entry={f} onSave={save} onDelete={remove} />
          ))}
          {!rows.length && !adding && (
            <p className="text-sm text-slate-500 text-center py-10">{formulas.length ? 'Sin resultados.' : 'Aún no hay fórmulas. Usa "Agregar" o "Importar CSV".'}</p>
          )}
        </div>

        <footer className="px-5 py-3 border-t border-slate-200 text-xs text-slate-500">
          {msg || 'Cada cambio se guarda al salir del campo y lo ven todas las personas que usan la app.'}
        </footer>
      </div>
    </div>
  );
}
