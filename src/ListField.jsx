import React from 'react';
import { clampList, countLines, tidyList } from './limits.js';
import { useLang } from './i18n.js';

const base =
  'w-full resize-y rounded-md border bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-violet-500';

/** Lista de ingredientes (uno por línea) con límite de renglones y de largo por renglón. */
export default function ListField({ name, value, onChange, limits, placeholder, tone = 'rose' }) {
  const { t } = useLang();
  const n = countLines(value);
  const full = n >= limits.lines;
  const near = n >= Math.ceil(limits.lines * 0.8);
  const longest = Math.max(0, ...String(value).split('\n').map((l) => l.trim().length));
  const color = full ? 'text-rose-700' : near ? 'text-amber-700' : tone === 'rose' ? 'text-rose-700/80' : 'text-sky-700/80';
  return (
    <div className="grid gap-1.5">
      <textarea
        name={name}
        value={value}
        rows={5}
        placeholder={placeholder}
        onChange={(e) => onChange(clampList(e.target.value, limits))}
        onBlur={(e) => onChange(tidyList(e.target.value))}
        className={`${base} ${full ? 'border-rose-500' : 'border-slate-300'}`}
      />
      <p className={`flex justify-between text-[11px] font-bold ${color}`}>
        <span>{full ? t('list.full', { max: limits.lines }) : t('list.lines', { n, max: limits.lines })}</span>
        <span>{t('list.chars', { max: limits.chars })}{longest >= limits.chars ? ' ·' : ''}</span>
      </p>
    </div>
  );
}
