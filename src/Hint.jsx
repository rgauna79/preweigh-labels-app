import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle } from 'lucide-react';

const W = 240; // ancho del globo

/** Un "?" pequeño que muestra una explicación breve al pulsarlo (o con el mouse encima). El globo se dibuja sobre toda la página para que no lo corte el scroll de la columna. */
export default function Hint({ text, label = '?' }) {
  const [pos, setPos] = useState(null); // null = cerrado
  const btn = useRef(null);
  const bubble = useRef(null);

  const show = () => {
    const r = btn.current.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.left - 8, window.innerWidth - W - 12)); // sin salirse por los lados
    setPos({ left, top: r.bottom + 6, above: r.top });
  };
  const hide = () => setPos(null);

  useEffect(() => {
    if (!pos) return undefined;
    const off = (e) => { if (!btn.current?.contains(e.target)) hide(); };
    document.addEventListener('mousedown', off);
    document.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => { document.removeEventListener('mousedown', off); document.removeEventListener('scroll', hide, true); window.removeEventListener('resize', hide); };
  }, [pos]);

  // Si no cabe abajo, se muestra arriba del "?"
  useEffect(() => {
    if (!pos || !bubble.current) return;
    const h = bubble.current.getBoundingClientRect().height;
    if (pos.top + h > window.innerHeight - 8 && pos.above - h - 6 > 8 && !pos.flipped) setPos({ ...pos, top: pos.above - h - 6, flipped: true });
  }, [pos]);

  return (
    <>
      <button ref={btn} type="button" aria-label={label} aria-expanded={Boolean(pos)}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); pos ? hide() : show(); }}
        onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide} onKeyDown={(e) => e.key === 'Escape' && hide()}
        className="inline-flex rounded-full align-middle text-slate-400 hover:text-violet-600 focus:text-violet-600">
        <HelpCircle size={13} />
      </button>
      {pos && createPortal(
        <span ref={bubble} role="tooltip" style={{ position: 'fixed', left: pos.left, top: pos.top, width: W }}
          className="pointer-events-none z-[70] rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold normal-case leading-snug tracking-normal text-white shadow-xl">
          {text}
        </span>,
        document.body
      )}
    </>
  );
}
