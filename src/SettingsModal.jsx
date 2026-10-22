import React, { useRef, useState } from 'react';
import { Database, ImagePlus, ListChecks, Loader2, Printer, X } from 'lucide-react';
import Modal from './Modal.jsx';
import { useLang } from './i18n.js';
import { QZ_DOWNLOAD, getPrinter, listPrinters, setPrinter } from './qz.js';

const card = 'rounded-xl border border-slate-200 p-4';

/** Tareas ocasionales (fórmulas, logo, nombre) fuera del flujo diario del panel. */
export default function SettingsModal({ formulasCount, onOpenFormulas, partsCount, onOpenParts, labelsEnabled, onLabelsEnabled, logo, onLogoFile, onRemoveLogo, by, onBy, stamp, onStamp, onClose }) {
  const { t } = useLang();
  const file = useRef(null);
  const [printers, setPrinters] = useState(null); // null = sin buscar
  const [printer, setPrinterState] = useState(getPrinter);
  const [finding, setFinding] = useState(false);
  const [qzError, setQzError] = useState('');
  const detect = async () => {
    setFinding(true); setQzError('');
    try { setPrinters(await listPrinters()); } catch { setPrinters(null); setQzError(t('qz.notFound')); } finally { setFinding(false); }
  };
  const pick = (name) => {
    setPrinter(name); setPrinterState(name);
    if (name) onLabelsEnabled?.(true); // si hay impresora elegida, el módulo de etiquetas queda disponible
  };
  return (
    <Modal onClose={onClose} className="max-w-lg" labelledBy="set-title">
      <header className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
        <h2 id="set-title" className="flex-1 text-lg font-extrabold">{t('settings.title')}</h2>
        <button onClick={onClose} className="rounded-md p-1.5 hover:bg-slate-100" aria-label={t('fm.close')}><X size={18} /></button>
      </header>

      <div className="grid gap-3 overflow-y-auto p-5">
        <section className={card}>
          <h3 className="text-sm font-extrabold">{t('settings.formulas')}</h3>
          <p className="mb-3 mt-0.5 text-xs text-slate-500">{t('settings.formulasDesc')}</p>
          <button onClick={onOpenFormulas} className="flex w-full items-center gap-2 rounded-md border border-slate-300 px-3 py-2.5 text-sm font-semibold hover:border-violet-400 hover:bg-violet-50">
            <ListChecks size={18} /> <span className="flex-1 text-left">{t('manage')}</span>
            <span className="text-xs text-slate-500">{formulasCount}</span>
          </button>
        </section>

        <section className={card}>
          <h3 className="text-sm font-extrabold">{t('settings.parts')}</h3>
          <p className="mb-3 mt-0.5 text-xs text-slate-500">{t('settings.partsDesc')}</p>
          <button onClick={onOpenParts} className="flex w-full items-center gap-2 rounded-md border border-slate-300 px-3 py-2.5 text-sm font-semibold hover:border-violet-400 hover:bg-violet-50">
            <Database size={18} /> <span className="flex-1 text-left">{t('settings.manageParts')}</span>
            <span className="text-xs text-slate-500">{partsCount ?? '…'}</span>
          </button>
        </section>

        <section className={card}>
          <h3 className="text-sm font-extrabold">{t('qz.title')}</h3>
          <p className="mb-3 mt-0.5 text-xs text-slate-500">{t('qz.desc')}</p>
          <div className="flex items-center gap-2">
            <select value={printer} onChange={(e) => pick(e.target.value)} onFocus={() => !printers && !finding && detect()} aria-label={t('qz.title')}
              className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-2 text-sm font-semibold">
              <option value="">{t('qz.dialog')}</option>
              {printer && !(printers || []).includes(printer) && <option value={printer}>{printer}</option>}
              {(printers || []).map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <button onClick={detect} disabled={finding} className="flex shrink-0 items-center gap-1.5 rounded-md bg-slate-100 px-3 py-2 text-xs font-bold hover:bg-slate-200 disabled:opacity-60">
              {finding ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />} {t('qz.detect')}
            </button>
          </div>
          {printers && !qzError && <p className="mt-2 text-xs font-semibold text-emerald-700">{t('qz.ok', { n: printers.length })}</p>}
          {qzError && (
            <p role="alert" className="mt-2 rounded-md border-l-4 border-amber-500 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
              {qzError} <a href={QZ_DOWNLOAD} target="_blank" rel="noreferrer" className="font-bold underline">{t('qz.get')}</a>
            </p>
          )}
        </section>

        <section className={card}>
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" checked={Boolean(labelsEnabled)} onChange={(e) => onLabelsEnabled?.(e.target.checked)} className="mt-1 h-4 w-4 accent-violet-600" />
            <span>
              <span className="block text-sm font-extrabold">{t('settings.labels')}</span>
              <span className="block text-xs text-slate-500">{t('settings.labelsHint')}</span>
            </span>
          </label>
        </section>

        <section className={card}>
          <h3 className="mb-3 text-sm font-extrabold">{t('settings.logo')}</h3>
          <input ref={file} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onLogoFile(f); e.target.value = ''; }} />
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-32 items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50">
              {logo ? <img src={logo} alt="" className="max-h-12 max-w-[7rem] object-contain" /> : <span className="text-xs text-slate-400">Logo</span>}
            </div>
            <button onClick={() => file.current?.click()} className="flex items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold hover:bg-slate-200">
              <ImagePlus size={16} /> {logo ? t('logo.change') : t('logo.upload')}
            </button>
            {logo && <button onClick={onRemoveLogo} className="rounded-md px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100">{t('remove')}</button>}
          </div>
        </section>

        <section className={card}>
          <label className="block">
            <span className="text-sm font-extrabold">{t('settings.by')}</span>
            <span className="mb-2 block text-xs text-slate-500">{t('settings.byHint')}</span>
            <input value={by} maxLength={40} onChange={(e) => onBy(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-violet-500" />
          </label>
        </section>

        <section className={card}>
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" checked={stamp} onChange={(e) => onStamp(e.target.checked)} className="mt-0.5 h-4 w-4 accent-violet-600" />
            <span>
              <span className="block text-sm font-extrabold">{t('settings.stamp')}</span>
              <span className="block text-xs text-slate-500">{t('settings.stampHint')}</span>
            </span>
          </label>
        </section>
      </div>
    </Modal>
  );
}
