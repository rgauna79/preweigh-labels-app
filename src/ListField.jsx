import React, { useMemo, useState } from 'react';
import { clampList, countLines, tidyList } from './limits.js';
import { useLang } from './i18n.js';
import { searchParts, useCatalog } from './catalog.js';
import Suggest from './Suggest.jsx';

const base =
  'w-full resize-y rounded-md border bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-violet-500';

/** Lista de ingredientes (uno por línea) con límite de renglones y de largo por renglón. */
export default function ListField({ name, value, onChange, limits, placeholder, tone = 'rose' }) {
  const { t } = useLang();
  const catalog = useCatalog();
  const [q, setQ] = useState('');
  const found = useMemo(() => searchParts(catalog, q, 10), [catalog, q]);
  const byPart = useMemo(() => new Map(catalog.map((i) => [i.part.toLowerCase(), i])), [catalog]);
  const fmt = (i) => `${i.part} ${i.description}`.trim();
  const addLine = (item) => {
    const cur = String(value).split('\n').map((l) => l.trim()).filter(Boolean);
    if (cur.some((l) => l.toLowerCase().split(/\s+/)[0] === item.part.toLowerCase())) { setQ(''); return; } // ya está en la lista
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
      <Suggest
        value={q} onChange={setQ} options={found.map((i) => ({ key: i.part, primary: i.part, secondary: i.description, item: i, tag: /^\d{6}$/.test(i.part) ? '' : t('list.variant') }))}
        onPick={(o) => addLine(o.item)} pickFirstOnEnter onEnter={() => q.trim() && !full && addLine({ part: q.trim(), description: '' })}
        disabled={full} placeholder={t('list.findPart')} ariaLabel={t('list.findPart')} className={`${base} border-slate-300 py-1.5 disabled:opacity-50`}
        emptyText={catalog.length ? t('list.noPart') : t('list.noCatalog')} footer={t('list.keys')}
      />
      <textarea
        name={name}
        value={value}
        rows={5}
        placeholder={placeholder}
        onChange={(e) => onChange(clampList(e.target.value, limits))}
        onBlur={(e) => onChange(clampList(complete(e.target.value), limits))}
        className={`${base} ${full ? 'border-rose-500' : 'border-slate-300'}`}
      />
      <p className={`flex justify-between text-[11px] font-bold ${color}`}>
        <span>{full ? t('list.full', { max: limits.lines }) : t('list.lines', { n, max: limits.lines })}</span>
        <span>{t('list.chars', { max: limits.chars })}{longest >= limits.chars ? ' ·' : ''}</span>
      </p>
    </div>
  );
}
