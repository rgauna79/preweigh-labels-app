import React, { useLayoutEffect, useRef } from 'react';

// Etiqueta: 10.5in x 8in (a 96 dpi). Se imprime centrada en hoja Letter horizontal.
export const LABEL_W = 1008;
export const LABEL_H = 768;

/** Texto de una sola línea que reduce su tamaño de fuente hasta caber en el ancho disponible. */
export function FitText({ text, max, min = 14, className = '', style }) {
  const boxRef = useRef(null);
  const innerRef = useRef(null);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const inner = innerRef.current;
    if (!box || !inner) return;
    const fit = () => {
      inner.style.fontSize = `${max}px`;
      const avail = box.clientWidth;
      const need = inner.scrollWidth;
      if (avail > 0 && need > avail) {
        inner.style.fontSize = `${Math.max(min, Math.floor((max * avail) / need) - 1)}px`;
      }
    };
    fit();
    document.fonts?.ready.then(fit);
  }, [text, max, min]);

  return (
    <div ref={boxRef} className={`overflow-hidden ${/(^|\s)w-/.test(className) ? '' : 'w-full'} ${className}`} style={style}>
      <span ref={innerRef} className="inline-block whitespace-nowrap" style={{ fontSize: max }}>
        {text || ' '}
      </span>
    </div>
  );
}

function Field({ label, value, className = '' }) {
  return (
    <div className={`flex items-end gap-5 ${className}`}>
      <span className="label-text shrink-0">{label}</span>
      <FitText text={value} max={42} className="flex-1 border-b-[3px] border-black text-center font-bold pb-0.5" />
    </div>
  );
}

function Logo({ logo }) {
  return (
    <div className="h-[72px] w-[280px] flex items-center justify-end">
      {logo ? (
        <img src={logo} alt="" className="max-h-full max-w-full object-contain" />
      ) : (
        <span className="logo-placeholder">Logo (clic para cargar)</span>
      )}
    </div>
  );
}

function PalletRow({ data }) {
  return (
    <div className="flex items-end gap-5">
      <span className="label-text">Number Pallet</span>
      <FitText text={data.palletNum} max={42} className="w-[110px] border-b-[3px] border-black text-center font-bold pb-0.5" />
      <span className="label-text">of</span>
      <FitText text={data.palletTotal} max={42} className="w-[110px] border-b-[3px] border-black text-center font-bold pb-0.5" />
    </div>
  );
}

export function PreweighTag({ data, logo, onLogoClick }) {
  return (
    <div className="label-page flex flex-col justify-between">
      <div className="flex items-end justify-between gap-6">
        <div className="flex items-end gap-5 flex-1">
          <span className="label-text shrink-0">Date Weighed:</span>
          <FitText text={data.date} max={46} className="w-[300px] flex-none border-b-[3px] border-black text-center font-bold pb-0.5" />
        </div>
        <div onClick={onLogoClick} className="cursor-pointer" title="Cambiar logo">
          <Logo logo={logo} />
        </div>
      </div>
      <Field label="Formula:" value={data.formula} />
      <Field label="Name:" value={data.name} />
      <Field label="Batch#" value={data.batch} />
      <Field label="P.O.#" value={data.po} />
      <Field label="Batches:" value={data.batches} />
      <PalletRow data={data} />
      <div className="flex gap-4 h-[96px]">
        <div className="flex-1 border-[3px] border-black flex items-center px-4">
          <FitText text={data.ile} max={56} className="text-center font-black" />
        </div>
        <div className="flex-1 border-[3px] border-black flex items-center px-4">
          <FitText text={data.identifier} max={56} className="text-center font-black" />
        </div>
      </div>
    </div>
  );
}

export function MissingTag({ data }) {
  return (
    <div className="label-page flex flex-col justify-between">
      <Field label="Date Weighed:" value={data.date} />
      <Field label="Name:" value={data.name} />
      <Field label="Batch#:" value={data.batch} />
      <Field label="P.O.#" value={data.po} />
      <Field label="Batches:" value={data.batches} />
      <PalletRow data={data} />
      <div className="flex flex-col gap-3 pt-2">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="flex items-end gap-6">
            <span className="w-[250px] shrink-0 text-[19px] font-medium tracking-wide">MISSING INGREDIENT</span>
            <FitText text={data[`missing${n}`]} max={28} className="flex-1 border-b-[3px] border-black font-medium pb-0.5" />
          </div>
        ))}
      </div>
    </div>
  );
}

const referItems = (data) => [1, 2, 3, 4].map((n) => data[`refer${n}`]).filter(Boolean);

export function ReferPage1({ data }) {
  const batchLine = [data.formula, data.name, data.batches].filter(Boolean).join(' ');
  return (
    <div className="label-page flex flex-col items-center text-center">
      <div className="text-[84px] font-black leading-none">{data.ile || 'ILE'}</div>
      <div className="text-[92px] font-black leading-none mt-3">KEEP IN REFER:</div>
      <div className="flex-1 w-full flex flex-col gap-1 pt-8">
        {referItems(data).map((t, i) => (
          <FitText key={i} text={t} max={48} min={22} className="font-medium text-center" />
        ))}
      </div>
      <div className="w-full">
        <div className="text-[50px] font-black leading-tight">BATCH:</div>
        <FitText text={batchLine} max={48} min={22} className="font-black text-center" />
        <FitText text={data.identifier} max={48} className="font-black text-center" />
      </div>
    </div>
  );
}

export function ReferPage2({ data }) {
  return (
    <div className="label-page flex flex-col items-center justify-center text-center">
      <div className="text-[112px] font-black leading-none">ITEMS IN</div>
      <div className="text-[112px] font-black leading-none mt-10 mb-16">REFER {data.ile || 'ILE'}</div>
      <div className="w-full flex flex-col gap-2">
        {referItems(data).map((t, i) => (
          <FitText key={i} text={t} max={56} min={24} className="font-medium text-center" />
        ))}
      </div>
    </div>
  );
}

/** Páginas que genera cada formato, según la opción elegida para Refer. */
export function getPages(format, data, referPages) {
  if (format === 'preweigh') return [PreweighTag];
  if (format === 'missing') return [MissingTag];
  const pages = [ReferPage1, ReferPage2];
  return referPages === '1' ? [pages[0]] : referPages === '2' ? [pages[1]] : pages;
}
