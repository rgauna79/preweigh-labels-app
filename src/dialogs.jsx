import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, KeyRound } from 'lucide-react';
import Modal from './Modal.jsx';
import { useLang } from './i18n.js';

// Ventanas de la app para confirmar y pedir el PIN (en lugar de las del navegador, que dicen solo "Aceptar/Cancelar").
let host = null;
const open = (spec, fallback) => new Promise((resolve) => (host ? host({ ...spec, resolve }) : resolve(fallback())));

/** confirmDialog({ title, message, confirmLabel, cancelLabel, tone: 'danger' | 'primary' }) → Promise<boolean> */
export const confirmDialog = (opts) => open({ kind: 'confirm', ...opts }, () => window.confirm(opts.message));
/** askPin({ wrong }) → Promise<string | null> (null = canceló) */
export const askPin = (opts = {}) => open({ kind: 'pin', ...opts }, () => window.prompt('PIN'));

function PinForm({ spec, done }) {
  const { t } = useLang();
  const [value, setValue] = useState('');
  const input = useRef(null);
  useEffect(() => { input.current?.focus(); }, []);
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (value.trim()) done(value); }}>
      <div className="flex items-start gap-3 px-5 pt-5">
        <KeyRound size={22} className="mt-0.5 shrink-0 text-violet-600" />
        <div className="min-w-0 flex-1">
          <h2 id="dlg-title" className="text-lg font-extrabold">{t('pin.title')}</h2>
          <p className="mt-1 text-sm text-slate-600">{t('pin.body')}</p>
          <input ref={input} type="password" value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" aria-label="PIN"
            className={`mt-3 w-full rounded-md border px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-violet-500 ${spec.wrong ? 'border-rose-500 bg-rose-50' : 'border-slate-300'}`} />
          {spec.wrong && <p role="alert" className="mt-1.5 text-xs font-bold text-rose-700">{t('pin.wrong')}</p>}
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
        <button type="button" onClick={() => done(null)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100">{t('dlg.cancel')}</button>
        <button type="submit" disabled={!value.trim()} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-violet-700 disabled:opacity-40">{t('pin.ok')}</button>
      </div>
    </form>
  );
}

function ConfirmForm({ spec, done }) {
  const { t } = useLang();
  const danger = spec.tone === 'danger';
  return (
    <>
      <div className="flex items-start gap-3 px-5 pt-5">
        <AlertTriangle size={22} className={`mt-0.5 shrink-0 ${danger ? 'text-rose-600' : 'text-amber-500'}`} />
        <div className="min-w-0 flex-1">
          <h2 id="dlg-title" className="text-lg font-extrabold">{spec.title}</h2>
          <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{spec.message}</p>
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
        <button autoFocus={!spec.focusConfirm} onClick={() => done(false)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100">{spec.cancelLabel || t('dlg.cancel')}</button>
        <button autoFocus={Boolean(spec.focusConfirm)} onClick={() => done(true)} className={`rounded-lg px-4 py-2 text-sm font-extrabold text-white ${danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-violet-600 hover:bg-violet-700'}`}>{spec.confirmLabel || t('dlg.ok')}</button>
      </div>
    </>
  );
}

/** Se monta una sola vez (main.jsx). */
export function DialogHost() {
  const [spec, setSpec] = useState(null);
  useEffect(() => { host = (s) => setSpec(s); return () => { host = null; }; }, []);
  if (!spec) return null;
  const done = (value) => {
    const { resolve, kind } = spec;
    setSpec(null);
    resolve(kind === 'confirm' ? Boolean(value) : value);
  };
  const cancel = () => done(spec.kind === 'confirm' ? false : null);
  return (
    <Modal onClose={cancel} className="max-w-md" labelledBy="dlg-title">
      {spec.kind === 'pin' ? <PinForm spec={spec} done={done} /> : <ConfirmForm spec={spec} done={done} />}
    </Modal>
  );
}
