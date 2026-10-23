import React, { useEffect, useRef, useState } from 'react';
import { HelpCircle } from 'lucide-react';

/** Un "?" pequeño que muestra una explicación breve al pulsarlo (o con el mouse encima). */
export default function Hint({ text, label = '?' }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const off = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', off);
    return () => document.removeEventListener('mousedown', off);
  }, [open]);
  return (
    <span ref={box} className="relative inline-flex align-middle" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" aria-label={label} aria-expanded={open} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)} className="rounded-full text-slate-400 hover:text-violet-600 focus:text-violet-600">
        <HelpCircle size={13} />
      </button>
      {open && (
        <span role="tooltip" className="absolute left-0 top-full z-40 mt-1 w-56 rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold normal-case leading-snug tracking-normal text-white shadow-xl">
          {text}
        </span>
      )}
    </span>
  );
}
