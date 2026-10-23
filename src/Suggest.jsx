import React, { useEffect, useId, useRef, useState } from 'react';

/** Resalta en `text` las palabras de `query`. */
function Hit({ text, query }) {
  const words = query.trim().split(/\s+/).filter(Boolean).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!words.length) return text;
  const parts = String(text).split(new RegExp(`(${words.join('|')})`, 'ig'));
  return parts.map((p, i) => (i % 2 ? <mark key={i} className="rounded-sm bg-violet-200/70 px-0 text-inherit">{p}</mark> : p));
}

/**
 * Campo con lista de sugerencias (teclado: ↑ ↓ Enter Esc).
 * options: [{ key, primary, secondary }] ya filtradas por el que la usa. onPick(option) al elegir.
 * pickFirstOnEnter: Enter sin flecha elige la primera. onEnter(): Enter cuando no hay nada que elegir.
 */
export default function Suggest({ value, onChange, options, onPick, onEnter, pickFirstOnEnter = false, placeholder, name, className, maxLength, inputRef, autoFocus, disabled, ariaLabel, footer, emptyText }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const list = useRef(null);
  const show = open && value.trim() && !disabled;

  useEffect(() => setActive(-1), [value]);
  useEffect(() => { list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }); }, [active]);

  const pick = (o) => { onPick(o); setOpen(false); setActive(-1); };
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(options.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(-1, a - 1)); }
    else if (e.key === 'Escape' && show) { e.stopPropagation(); setOpen(false); }
    else if (e.key === 'Enter') {
      const o = options[active] ?? (pickFirstOnEnter ? options[0] : null);
      if (show && o) { e.preventDefault(); pick(o); } else if (onEnter) { e.preventDefault(); onEnter(); }
    }
  };

  return (
    <div className="relative">
      <input
        ref={inputRef} name={name} value={value} maxLength={maxLength} autoFocus={autoFocus} disabled={disabled} placeholder={placeholder} aria-label={ariaLabel}
        role="combobox" aria-expanded={Boolean(show)} aria-controls={`${id}-list`} aria-autocomplete="list" aria-activedescendant={active >= 0 ? `${id}-${active}` : undefined}
        autoComplete="off" className={className}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)} onKeyDown={onKeyDown}
      />
      {show && (
        <ul id={`${id}-list`} ref={list} role="listbox" className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-md border border-slate-300 bg-white py-1 text-sm shadow-lg">
          {options.length ? options.map((o, i) => (
            <li key={o.key} id={`${id}-${i}`} role="option" aria-selected={i === active}>
              <button type="button" tabIndex={-1} onMouseDown={(e) => { e.preventDefault(); pick(o); }} onMouseEnter={() => setActive(i)}
                className={`flex w-full items-baseline gap-2 px-3 py-1.5 text-left ${i === active ? 'bg-violet-100' : 'hover:bg-violet-50'}`}>
                <b className="shrink-0 font-mono text-xs">{<Hit text={o.primary} query={value} />}</b>
                <span className="truncate font-semibold text-slate-700"><Hit text={o.secondary || ''} query={value} /></span>
              </button>
            </li>
          )) : <li className="px-3 py-2 text-xs font-semibold text-slate-400">{emptyText}</li>}
          {footer && <li className="border-t border-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-400">{footer}</li>}
        </ul>
      )}
    </div>
  );
}
