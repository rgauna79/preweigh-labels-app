import React from 'react';
import { Undo2 } from 'lucide-react';
import { useLang } from './i18n.js';

/** Aviso breve abajo al centro, con "Deshacer" opcional. */
export default function Toast({ toast, onUndo }) {
  const { t } = useLang();
  if (!toast) return null;
  return (
    <div role="status" className="lm-slide fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-4 rounded-full bg-slate-900 py-2.5 pl-5 pr-3 text-sm font-semibold text-white shadow-2xl">
      <span>{toast.text}</span>
      {toast.action && (
        <button onClick={toast.action.onClick} className="flex items-center gap-1.5 rounded-full bg-violet-500 px-3 py-1 text-xs font-extrabold hover:bg-violet-400">
          {toast.action.label}
        </button>
      )}
      {toast.undo && (
        <button onClick={onUndo} className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-extrabold hover:bg-white/25">
          <Undo2 size={13} /> {t('undo')}
        </button>
      )}
    </div>
  );
}
