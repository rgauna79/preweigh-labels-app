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

// Todas las filas de una etiqueta son celdas de UNA sola cuadrícula:
// [etiqueta | línea A | "of" | línea B]. La 1ª columna mide lo que la palabra más larga
// ("Date Weighed:", "Number Pallet"), así todas las líneas arrancan en el mismo punto.
const LINE = 'border-b-[3px] border-black text-center font-bold pb-0.5';
const LABEL = 'label-text pr-3.5';

function TagGrid({ children }) {
  return (
    <div
      className="flex-1 grid items-end"
      style={{ gridTemplateColumns: 'max-content 1fr 70px 1fr', alignContent: 'space-between' }}
    >
      {children}
    </div>
  );
}

/** Una fila de la etiqueta: texto + línea que ocupa todo el ancho restante. */
function Field({ label, value }) {
  return (
    <>
      <span className={LABEL}>{label}</span>
      <FitText text={value} max={42} className={`col-span-3 ${LINE}`} />
    </>
  );
}

function Logo({ logo }) {
  return (
    <div className="h-[72px] w-full flex items-center justify-end">
      {logo ? (
        <img src={logo} alt="" className="max-h-full max-w-full object-contain" />
      ) : (
        <span className="logo-placeholder">Logo</span>
      )}
    </div>
  );
}

function PalletRow({ data }) {
  return (
    <>
      <span className={LABEL}>Number Pallet</span>
      <FitText text={data.palletNum} max={42} className={LINE} />
      <span className="label-text text-center">of</span>
      <FitText text={data.palletTotal} max={42} className={LINE} />
    </>
  );
}

/** "ID-" va siempre delante: el usuario solo escribe el código (G9FB71). */
export const stripId = (v) => String(v ?? '').trim().replace(/^ID[-\s]*/i, '').toUpperCase();
export const formatId = (v) => (stripId(v) ? `ID-${stripId(v)}` : '');

/** Lista de ingredientes (uno por línea de texto) sin líneas vacías. */
export const toItems = (text) => String(text ?? '').split('\n').map((t) => t.trim()).filter(Boolean);

/**
 * Lista centrada que se adapta a la cantidad: 1 columna hasta 6 ítems, 2 hasta 14 y 3 después.
 * La altura de cada fila se reparte en el alto disponible para que siempre quepan.
 */
function ItemList({ items, area, maxFont, min = 14, weight = 'font-medium' }) {
  const cols = items.length <= 6 ? 1 : items.length <= 14 ? 2 : 3;
  const rows = Math.ceil(items.length / cols);
  const rowH = Math.min(maxFont * 1.3, area / Math.max(rows, 1));
  const font = Math.max(min, Math.floor(rowH / 1.3));
  return (
    <div className="w-full grid gap-x-8" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoFlow: 'column', gridTemplateRows: `repeat(${rows}, ${rowH}px)` }}>
      {items.map((t, i) => (
        <FitText key={i} text={t} max={font} min={10} className={`text-center ${weight}`} />
      ))}
    </div>
  );
}

export function PreweighTag({ data, logo, onLogoClick }) {
  return (
    <div className="label-page flex flex-col">
      <TagGrid>
        <span className={LABEL}>Date Weighed:</span>
        <FitText text={data.date} max={44} className={LINE} />
        <span />
        <div onClick={onLogoClick} className="cursor-pointer pl-6" title="Cambiar logo">
          <Logo logo={logo} />
        </div>
        <Field label="Formula:" value={data.formula} />
        <Field label="Name:" value={data.name} />
        <Field label="Batch#" value={data.batch} />
        <Field label="P.O.#" value={data.po} />
        <Field label="Batches:" value={data.batches} />
        <PalletRow data={data} />
        <div className="col-span-4 grid grid-cols-2 gap-6 h-[96px]">
          <div className="border-[3px] border-black flex items-center px-4">
            <FitText text={data.ile} max={56} className="text-center font-black" />
          </div>
          <div className="border-[3px] border-black flex items-center px-4">
            <FitText text={formatId(data.identifier)} max={56} className="text-center font-black" />
          </div>
        </div>
      </TagGrid>
    </div>
  );
}

export function MissingTag({ data }) {
  const items = toItems(data.missing);
  const many = items.length > 4;
  return (
    <div className="label-page flex flex-col">
      <TagGrid>
        <Field label="Date Weighed:" value={data.date} />
        <Field label="Name:" value={data.name} />
        <Field label="Batch#:" value={data.batch} />
        <Field label="P.O.#" value={data.po} />
        <Field label="Batches:" value={data.batches} />
        <PalletRow data={data} />
        {/* Hasta 4: una línea por ingrediente con su rótulo. Más de 4: encabezado y lista en columnas. */}
        {!many &&
          items.map((t, i) => (
            <React.Fragment key={i}>
              <span className="text-[19px] font-medium tracking-wide pr-3.5 pb-1 whitespace-nowrap">MISSING INGREDIENT</span>
              <FitText text={t} max={28} className="col-span-3 border-b-[3px] border-black font-medium pb-0.5" />
            </React.Fragment>
          ))}
        {many && (
          <div className="col-span-4">
            <MissingMany items={items} />
          </div>
        )}
      </TagGrid>
    </div>
  );
}

function MissingMany({ items }) {
  const cols = items.length <= 16 ? 2 : 3;
  const rows = Math.ceil(items.length / cols);
  const rowH = Math.min(40, Math.floor(250 / rows));
  const font = Math.max(12, Math.floor(rowH * 0.62));
  return (
    <div>
      <div className="text-[19px] font-bold tracking-wide mb-1">MISSING INGREDIENTS</div>
      <div className="grid gap-x-8" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoFlow: 'column', gridTemplateRows: `repeat(${rows}, ${rowH}px)` }}>
        {items.map((t, i) => (
          <FitText key={i} text={t} max={font} min={11} className="border-b-2 border-black font-medium" />
        ))}
      </div>
    </div>
  );
}

export function ReferPage1({ data }) {
  const items = toItems(data.refer);
  const batchLine = [data.formula, data.name, data.batches].filter(Boolean).join(' ');
  return (
    <div className="label-page flex flex-col items-center text-center">
      <div className="text-[84px] font-black leading-none">{data.ile || 'ILE'}</div>
      <div className="text-[92px] font-black leading-none mt-3">KEEP IN REFER:</div>
      <div className="flex-1 w-full flex items-center pt-4 pb-4">
        <ItemList items={items} area={250} maxFont={48} min={16} />
      </div>
      <div className="w-full">
        <div className="text-[50px] font-black leading-tight">BATCH:</div>
        <FitText text={batchLine} max={48} min={22} className="font-black text-center" />
        <FitText text={formatId(data.identifier)} max={48} className="font-black text-center" />
      </div>
    </div>
  );
}

export function ReferPage2({ data }) {
  const items = toItems(data.refer);
  const compact = items.length > 4; // con muchos ítems el título se achica para dejar espacio
  const title = compact ? 84 : 112;
  return (
    <div className="label-page flex flex-col items-center text-center">
      <div className="font-black leading-none" style={{ fontSize: title }}>ITEMS IN</div>
      <div className="font-black leading-none" style={{ fontSize: title, marginTop: compact ? 14 : 36 }}>REFER {data.ile || 'ILE'}</div>
      <div className="flex-1 w-full flex items-center pt-4">
        <ItemList items={items} area={compact ? 400 : 300} maxFont={56} min={16} />
      </div>
    </div>
  );
}

/**
 * Arma el juego de hojas de un batch:
 *  - por cada pallet: tag Preweigh (y su tag Missing si faltan ingredientes)
 *  - si hay refrigerados: hoja "KEEP IN REFER" (va en el pallet de refrigerados)
 *    y hoja "ITEMS IN REFER" (se anexa al batch record)
 */
export function buildSheets(data, { pallets, withMissing, withRefer }) {
  const sheets = [];
  const n = Math.max(1, pallets);
  for (let i = 1; i <= n; i++) {
    const d = { ...data, palletNum: String(i), palletTotal: String(n) };
    sheets.push({ key: `pre${i}`, label: ['sheet.pre', { i, n }], Comp: PreweighTag, data: d });
    if (withMissing) {
      sheets.push({ key: `mis${i}`, label: ['sheet.mis', { i, n }], Comp: MissingTag, data: d });
    }
  }
  if (withRefer) {
    sheets.push({ key: 'ref1', label: ['sheet.ref1'], Comp: ReferPage1, data });
    sheets.push({ key: 'ref2', label: ['sheet.ref2'], Comp: ReferPage2, data });
  }
  return sheets;
}
