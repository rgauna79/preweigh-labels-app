import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import Modal from './Modal.jsx';
import { useLang } from './i18n.js';

/** Guía rápida de 4 pasos: se muestra la primera vez y se puede abrir de nuevo desde Ajustes. */
export default function WelcomeGuide({ onClose }) {
  const { t } = useLang();
  return (
    <Modal onClose={onClose} className="max-w-lg" labelledBy="guide-title">
      <header className="border-b border-slate-200 px-5 py-4">
        <h2 id="guide-title" className="text-lg font-extrabold">{t('guide.title')}</h2>
        <p className="mt-0.5 text-sm text-slate-500">{t('guide.sub')}</p>
      </header>
      <ol className="grid gap-3 overflow-y-auto p-5">
        {[1, 2, 3, 4].map((n) => (
          <li key={n} className="flex items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-600 text-sm font-extrabold text-white">{n}</span>
            <div>
              <p className="text-sm font-extrabold">{t(`guide.s${n}`)}</p>
              <p className="text-sm text-slate-600">{t(`guide.s${n}d`)}</p>
            </div>
          </li>
        ))}
        <li className="rounded-md bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-900">{t('guide.tip')}</li>
      </ol>
      <footer className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-3">
        <button autoFocus onClick={onClose} className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-violet-700">
          <CheckCircle2 size={16} /> {t('guide.ok')}
        </button>
      </footer>
    </Modal>
  );
}
