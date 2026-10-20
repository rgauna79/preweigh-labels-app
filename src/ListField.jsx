import React, { useMemo, useState } from 'react';
import { clampList, countLines, tidyList } from './limits.js';
import { useLang } from './i18n.js';
import { searchParts, useCatalog } from './catalog.js';

const base =
  'w-full resize-y rounded-md border bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-violet-500';

/** Lista de ingredientes (uno por línea) con límite de renglones y de largo por renglón. */
export default function ListField({ name, value, onChange, limits, placeholder, tone = 'rose' }) {
  const { t } = useLang();
  const catalog = useCatalog();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const found = useMemo(() => searchParts(catalog, q), [catalog, q]);
  const byPart = useMemo(() => new Map(catalog.map((i) => [i.part.toLowerCase(), i])), [catalog]);
  const fmt = (i) => `${i.part} ${i.description}`.trim();
  const addLine = (item) => {
    const cur = String(value).split('\n').map((l) => l.trim()).filter(Boolean);
    onChange(clampList([...cur, fmt(item)].join('\n'), limits));
    setQ('');
  };
  // Líneas que son solo un número de parte (ej. pegadas desde Excel) se completan con su descripción
  const complete = (text) => tidyList(text).split('\n').map((l) => {
    const hit = byPart.get(l.trim().toLowerCase());
    return hit ? fmt(hit) : l;
  }).join('\n');
  const n = countLines(value);
  const full = n >= limits.lines;
  const near = n >= Math.ceil(limits.lines * 0.8);
  const longest = Math.max(0, ...String(value).split('\n').map((l) => l.trim().length));
  const color = full ? 'text-rose-700' : near ? 'text-amber-700' : tone === 'rose' ? 'text-rose-700/80' : 'text-sky-700/80';
  return (
    <div className="grid gap-1.5">
      <div className="relative">
        <input
          value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (found[0] && !full) addLine(found[0]); } }}
          disabled={full} placeholder={t('list.findPart')} aria-label={t('list.findPart')}
          className={`${base} border-slate-300 py-1.5 disabled:opacity-50`}
        />
        {open && q.trim() && !full && (
          <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-slate-300 bg-white text-sm shadow-lg">
            {found.length ? found.map((i) => (
              <li key={i.part}>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); addLine(i); }} className="flex w-full gap-2 px-3 py-1.5 text-left hover:bg-violet-50">
                  <b className="shrink-0 font-mono text-xs leading-5">{i.part}</b><span className="truncate font-semibold">{i.description}</span>
                </button>
              </li>
            )) : <li className="px-3 py-2 text-xs font-semibold text-slate-400">{catalog.length ? t('list.noPart') : t('list.noCatalog')}</li>}
          </ul>
        )}
      </div>
      <textarea
        name={name}
        value={value}
        rows={5}
        placeholder={placeholder}
        onChange={(e) => onChange(clampList(e.target.value, limits))}
        onBlur={(e) => onChange(complete(e.target.value))}
        className={`${base} ${full ? 'border-rose-500' : 'border-slate-300'}`}
      />
      <p className={`flex justify-between text-[11px] font-bold ${color}`}>
        <span>{full ? t('list.full', { max: limits.lines }) : t('list.lines', { n, max: limits.lines })}</span>
        <span>{t('list.chars', { max: limits.chars })}{longest >= limits.chars ? ' ·' : ''}</span>
      </p>
    </div>
  );
}
