import React, { useEffect, useRef } from 'react';

/** Ventana modal: se cierra con Esc o al hacer clic fuera, enfoca su contenido y devuelve el foco al cerrar. */
export default function Modal({ onClose, className = 'max-w-3xl', labelledBy, children }) {
  const card = useRef(null);
  const closeRef = useRef(onClose); // onClose suele ser una función nueva en cada render; no debe reiniciar el efecto (robaba el foco al escribir)
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    card.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-6" onClick={onClose}>
      <div
        ref={card}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`relative flex max-h-full w-full flex-col overflow-hidden rounded-xl bg-white shadow-2xl outline-none ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
