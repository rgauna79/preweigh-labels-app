import React, { useMemo, useState } from 'react';
import { AlertTriangle, RotateCcw, Search, X } from 'lucide-react';
import Modal from './Modal.jsx';
import { useLang } from './i18n.js';
import { fmtStamp } from './checks.js';

/** Últimas impresiones de todos los usuarios. "Cargar" rellena el formulario para reimprimir ese batch. */
export default function HistoryModal({ history, error, onLoad, onClose }) {
  const { t } = useLang();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const rows = useMemo(
    () => history.filter((h) => !q || [h.formula, h.name, h.identifier, h.batch, h.batches, h.po].some((v) => String(v ?? '').toLowerCase().includes(q))),
    [history, q]
  );

  return (
    <Modal onClose={onClose} className="max-w-4xl" labelledBy="hist-title">
      <header className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
        <h2 id="hist-title" className="flex-1 text-lg font-extrabold">{t('hist.title')}</h2>
        <button onClick={onClose} className="rounded-md p-1.5 hover:bg-slate-100" aria-label={t('fm.close')}><X size={18} /></button>
      </header>

      {error && (
        <div role="alert" className="lm-slide mx-5 mt-3 flex items-center gap-2 rounded-lg border-l-4 border-rose-600 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900">
          <AlertTriangle size={18} className="text-rose-600" /> {error}
        </div>
      )}

      <div className="border-b border-slate-100 px-5 py-3">
        <div className="relative">
          <Search size={15} className="absolute left-2.5 top-2.5 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('hist.search')}
            className="w-full rounded-md border border-slate-300 py-2 pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-violet-500" />
        </div>
      </div>

      <div className="min-h-[200px] flex-1 overflow-auto px-3 py-2">
        <table className="w-full text-left text-sm">
          <thead className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-2 py-1.5">{t('hist.date')}</th><th className="px-2">{t('hist.formula')}</th><th className="px-2">{t('lbl.name')}</th>
              <th className="px-2">{t('hist.batch')}</th><th className="px-2">{t('hist.id')}</th><th className="px-2">{t('hist.pallets')}</th><th className="px-2">{t('hist.by')}</th><th />
            </tr>
          </thead>
          <tbody>
            {rows.map((h) => {
              const { d, h: hh } = fmtStamp(h.ts);
              return (
                <tr key={`${h.ts}-${h.formula}-${h.identifier}`} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="whitespace-nowrap px-2 py-2 text-slate-600">{d} <span className="text-slate-400">{hh}</span></td>
                  <td className="px-2 font-extrabold">{h.formula}</td>
                  <td className="max-w-[220px] truncate px-2" title={h.name}>{h.name}</td>
                  <td className="whitespace-nowrap px-2 font-semibold">{h.batches || h.batch}</td>
                  <td className="whitespace-nowrap px-2 font-mono text-xs font-bold">{h.identifier ? `ID-${h.identifier}` : '—'}</td>
                  <td className="px-2 text-center">
                    {h.pallets}
                    {h.printed && (
                      <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800"
                        title={h.printed.split(', ').map((k) => (/^pre\d+$/.test(k) ? t('chip.pre', { i: k.slice(3) }) : /^mis\d+$/.test(k) ? t('chip.mis', { i: k.slice(3) }) : t(`chip.${k}`))).join(' · ')}>
                        {t('hist.partial')}
                      </span>
                    )}
                  </td>
                  <td className="max-w-[90px] truncate px-2 text-slate-500" title={h.by}>{h.by || '—'}</td>
                  <td className="px-2 text-right">
                    <button onClick={() => onLoad(h)} className="inline-flex items-center gap-1 rounded-md bg-violet-100 px-2.5 py-1 text-xs font-bold text-violet-700 hover:bg-violet-200">
                      <RotateCcw size={12} /> {t('hist.load')}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && <p className="py-12 text-center text-sm text-slate-500">{history.length ? t('hist.noResults') : t('hist.empty')}</p>}
      </div>

      <footer className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500">{t('hist.footer')}</footer>
    </Modal>
  );
}
