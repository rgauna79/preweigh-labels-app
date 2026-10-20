import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardPaste, Download, FileUp, Loader2, Plus, Search, Trash2, X } from 'lucide-react';
import Modal from './Modal.jsx';
import { useLang } from './i18n.js';
import { fetchAllItems, writeItems } from './api.js';
import { downloadText } from './formulas.js';
import { DESC_MAX, PART_MAX, oddPart, parsePartsText } from './partsParse.js';
import Papa from 'papaparse';

const SHOW = 200;
const cell = 'w-full rounded-md border border-transparent bg-transparent px-2.5 py-1.5 text-sm font-semibold outline-none hover:border-slate-300 focus:border-violet-500 focus:ring-2 focus:ring-violet-200';

/** Catálogo de partes compartido: buscar, editar, borrar, importar desde Excel (pegar o CSV) con vista previa y exportar. */
export default function PartsManager({ onClose, onChanged }) {
  const { t } = useLang();
  const [items, setItems] = useState(null); // null = cargando
  const [q, setQ] = useState('');
  const [notice, setNotice] = useState(null); // { type, text }
  const [busy, setBusy] = useState(false);
  const [imp, setImp] = useState(null); // { text } cuando el panel de importación está abierto
  const [updateChanged, setUpdateChanged] = useState(true);
  const [add, setAdd] = useState({ part: '', description: '' });
  const fileRef = useRef(null);

  const load = async () => {
    try { setItems(await fetchAllItems()); } catch (e) { setItems([]); setNotice({ type: 'error', text: e.message }); }
  };
  useEffect(() => { load(); }, []);

  const sorted = useMemo(() => (items || []).slice().sort((a, b) => a.part.localeCompare(b.part, undefined, { numeric: true })), [items]);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? sorted.filter((i) => i.part.toLowerCase().includes(s) || i.description.toLowerCase().includes(s)) : sorted;
  }, [sorted, q]);

  const run = async (fn, okText) => {
    setBusy(true);
    try { await fn(); setNotice(okText ? { type: 'success', text: okText } : null); onChanged?.(); } catch (e) { setNotice({ type: 'error', text: e.message }); } finally { setBusy(false); }
  };

  const saveRow = (item, description) => {
    if (description === item.description) return;
    setItems((l) => l.map((i) => (i.part === item.part ? { ...i, description } : i)));
    run(() => writeItems('upsert', [{ part: item.part, description }]));
  };
  const remove = (item) => {
    if (!window.confirm(t('parts.confirmDel', { p: item.part }))) return;
    setItems((l) => l.filter((i) => i.part !== item.part));
    run(() => writeItems('delete', [item]));
  };
  const addOne = () => {
    const part = add.part.trim();
    if (!part) return;
    const item = { part, description: add.description.trim() };
    if (known.has(part.toLowerCase())) { setNotice({ type: 'error', text: t('parts.exists', { p: part }) }); return; }
    setItems((l) => [...l, item]);
    setAdd({ part: '', description: '' });
    run(() => writeItems('add', [item])); // agregar una parte nueva no pide PIN; editar o borrar sí
  };

  // --- Importación: vista previa de lo que cambiaría antes de escribir nada
  const known = useMemo(() => new Map((items || []).map((i) => [i.part.toLowerCase(), i])), [items]);
  const preview = useMemo(() => {
    if (!imp?.text.trim()) return null;
    const { items: list, dupes, bad } = parsePartsText(imp.text);
    const fresh = []; const changed = []; let same = 0;
    list.forEach((i) => {
      const cur = known.get(i.part.toLowerCase());
      if (!cur) fresh.push(i);
      else if (cur.description !== i.description) changed.push({ ...i, was: cur.description });
      else same++;
    });
    return { list, dupes, bad, fresh, changed, same, odd: list.filter((i) => oddPart(i.part)) };
  }, [imp, known]);

  const doImport = () => {
    const write = [...preview.fresh, ...(updateChanged ? preview.changed : [])].map(({ part, description }) => ({ part, description }));
    if (!write.length) return;
    run(async () => {
      for (let i = 0; i < write.length; i += 2000) await writeItems('upsert', write.slice(i, i + 2000));
      await load();
      setImp(null);
    }, t('parts.imported', { n: write.length }));
  };

  const onFile = (file) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => setImp({ text: String(r.result || '') });
    r.readAsText(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  const exportCsv = () => downloadText('parts.csv', Papa.unparse(sorted.map((i) => ({ Part: i.part, Description: i.description })), { columns: ['Part', 'Description'] }));

  return (
    <Modal onClose={onClose} className="max-w-4xl" labelledBy="pm-title">
      <header className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
        <h2 id="pm-title" className="flex-1 text-lg font-extrabold">{t('parts.title', { n: items ? items.length : '…' })}</h2>
        {busy && <Loader2 size={18} className="animate-spin text-violet-600" />}
        <button onClick={onClose} aria-label={t('fm.close')} className="rounded p-1.5 hover:bg-slate-100"><X size={18} /></button>
      </header>

      {notice && (
        <div role={notice.type === 'error' ? 'alert' : 'status'} className={`mx-5 mt-3 flex items-start gap-2.5 rounded-lg border-l-4 px-3 py-2.5 text-sm font-semibold ${notice.type === 'error' ? 'border-rose-600 bg-rose-50 text-rose-900' : 'border-emerald-600 bg-emerald-50 text-emerald-900'}`}>
          {notice.type === 'error' ? <AlertTriangle size={18} className="shrink-0 text-rose-600" /> : <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />}
          <span className="flex-1">{notice.text}</span>
          <button onClick={() => setNotice(null)} aria-label={t('fm.dismiss')}><X size={14} /></button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 px-5 py-3">
        <label className="relative min-w-[200px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-2.5 top-2.5 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('parts.search')} className="w-full rounded-md border border-slate-300 py-2 pl-8 pr-2 text-sm font-semibold" />
        </label>
        <button onClick={() => setImp((v) => (v ? null : { text: '' }))} className="flex items-center gap-1.5 rounded-md bg-violet-100 px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-200"><ClipboardPaste size={14} /> {t('parts.import')}</button>
        <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"><FileUp size={14} /> {t('parts.file')}</button>
        <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <button onClick={exportCsv} disabled={!sorted.length} className="flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"><Download size={14} /> {t('fm.export')}</button>
      </div>

      {imp && (
        <div className="mx-5 mb-3 space-y-2 rounded-lg border border-violet-200 bg-violet-50 p-3">
          <p className="text-xs font-semibold text-slate-600">{t('parts.pasteHelp')}</p>
          <textarea value={imp.text} onChange={(e) => setImp({ text: e.target.value })} rows={5} autoFocus placeholder={'PartNumber\tName\n700000\tAcerola Cherry Extract 25%'}
            className="w-full rounded-md border border-slate-300 p-2 font-mono text-xs" />
          {preview && (
            <div className="space-y-1.5 text-sm">
              <p className="font-bold text-slate-800">{t('parts.summary', { n: preview.list.length, a: preview.fresh.length, c: preview.changed.length, s: preview.same })}</p>
              {preview.dupes > 0 && <p className="text-xs font-semibold text-amber-800">{t('parts.dupes', { n: preview.dupes })}</p>}
              {preview.bad.length > 0 && <p className="text-xs font-bold text-rose-800">{t('parts.bad', { n: preview.bad.length, ex: preview.bad.slice(0, 3).map((b) => b.part).join(', '), p: PART_MAX, d: DESC_MAX })}</p>}
              {preview.odd.length > 0 && <p className="text-xs font-semibold text-amber-800">{t('parts.odd', { n: preview.odd.length, ex: preview.odd.slice(0, 6).map((b) => `"${b.part}"`).join(', ') })}</p>}
              {preview.changed.length > 0 && (
                <div className="max-h-28 overflow-auto rounded bg-white p-2 text-xs">
                  {preview.changed.slice(0, 20).map((c) => <p key={c.part}><b>{c.part}</b>: <s className="text-slate-400">{c.was}</s> → {c.description}</p>)}
                  {preview.changed.length > 20 && <p className="text-slate-400">…</p>}
                </div>
              )}
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <input type="checkbox" checked={updateChanged} onChange={(e) => setUpdateChanged(e.target.checked)} /> {t('parts.updateChanged')}
              </label>
              <button onClick={doImport} disabled={busy || !(preview.fresh.length + (updateChanged ? preview.changed.length : 0))}
                className="rounded-md bg-violet-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-violet-700 disabled:opacity-40">
                {t('parts.doImport', { n: preview.fresh.length + (updateChanged ? preview.changed.length : 0) })}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto border-t border-slate-200">
        {items === null ? (
          <p className="flex items-center justify-center gap-2 p-8 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> {t('parts.loading')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <tr><th className="w-40 px-3 py-2 text-left">{t('ing.part')}</th><th className="px-1 text-left">{t('ing.desc')}</th><th className="w-10" /></tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100 bg-violet-50/50">
                <td className="px-2 py-1"><input value={add.part} maxLength={PART_MAX} placeholder="700000" onChange={(e) => setAdd((a) => ({ ...a, part: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && addOne()} className={cell} /></td>
                <td className="px-1 py-1"><input value={add.description} maxLength={DESC_MAX} placeholder={t('ing.desc')} onChange={(e) => setAdd((a) => ({ ...a, description: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && addOne()} className={cell} /></td>
                <td className="pr-2"><button onClick={addOne} disabled={!add.part.trim()} aria-label={t('fm.add')} className="rounded p-1 text-violet-700 hover:bg-violet-100 disabled:opacity-30"><Plus size={16} /></button></td>
              </tr>
              {shown.slice(0, SHOW).map((i) => (
                <tr key={i.part} className="border-b border-slate-100">
                  <td className={`px-3 py-1.5 font-mono text-xs font-bold ${oddPart(i.part) ? 'text-amber-700' : 'text-slate-700'}`}>{i.part}</td>
                  <td className="px-1 py-1"><input defaultValue={i.description} maxLength={DESC_MAX} onBlur={(e) => saveRow(i, e.target.value.trim())} className={cell} /></td>
                  <td className="pr-2"><button onClick={() => remove(i)} aria-label={t('ing.remove')} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {items && !shown.length && <p className="p-8 text-center text-sm text-slate-500">{items.length ? t('parts.noMatch') : t('parts.empty')}</p>}
        {shown.length > SHOW && <p className="p-3 text-center text-xs font-semibold text-slate-400">{t('parts.more', { n: SHOW, t: shown.length })}</p>}
      </div>
    </Modal>
  );
}
