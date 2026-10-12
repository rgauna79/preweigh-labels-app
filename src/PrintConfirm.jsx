import React from 'react';
import { AlertTriangle, Info, Printer } from 'lucide-react';
import Modal from './Modal.jsx';
import { useLang } from './i18n.js';

/** Resumen antes de imprimir; solo aparece cuando hay algo que revisar. */
export default function PrintConfirm({ checks, total, breakdown, onFix, onPrint }) {
  const { t } = useLang();
  return (
    <Modal onClose={onFix} className="max-w-lg" labelledBy="pc-title">
      <header className="border-b border-slate-200 px-5 py-4">
        <h2 id="pc-title" className="text-lg font-extrabold">{t('confirm.title')}</h2>
        <p className="mt-0.5 text-sm text-slate-500">{total === 1 ? t('confirm.summaryOne') : t('confirm.summary', { n: total })} · {breakdown}</p>
      </header>
      <ul className="grid gap-2 overflow-y-auto p-5">
        {checks.map((c, i) => (
          <li key={i} className={`flex items-start gap-2.5 rounded-lg border-l-4 px-3 py-2.5 text-sm font-semibold ${
            c.level === 'error' ? 'border-rose-600 bg-rose-50 text-rose-900' : 'border-amber-500 bg-amber-50 text-amber-900'}`}>
            {c.level === 'error' ? <AlertTriangle size={18} className="mt-px shrink-0 text-rose-600" /> : <Info size={18} className="mt-px shrink-0 text-amber-600" />}
            <span>{c.text}</span>
          </li>
        ))}
      </ul>
      <footer className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
        <button autoFocus onClick={onFix} className="rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-violet-700">{t('confirm.fix')}</button>
        <button onClick={onPrint} className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100">
          <Printer size={15} /> {t('confirm.print')}
        </button>
      </footer>
    </Modal>
  );
}
