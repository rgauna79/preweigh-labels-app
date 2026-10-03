import React, { useLayoutEffect, useRef } from 'react';

// Etiqueta: 10.5in x 8in (a 96 dpi). Se imprime centrada en hoja Letter horizontal.
export const LABEL_W = 1008;
export const LABEL_H = 768;

/** Texto de una sola línea que reduce su tamaño de letra hasta caber en el ancho disponible. */
export function FitText({ text, max, min = 14, className = '', style, lock = false }) {
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

  // lock: alto fijo según el tamaño máximo, para que una fila no se encoja cuando su texto se reduce.
  const lockStyle = lock
    ? {
        height: Math.ceil(max * 1.2),
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: /text-center/.test(className) ? 'center' : 'flex-start',
      }
    : null;

  return (
    <div ref={boxRef} className={`overflow-hidden ${/(^|\s)w-/.test(className) ? '' : 'w-full'} ${className}`} style={{ ...lockStyle, ...style }}>
      <span ref={innerRef} className="inline-block whitespace-nowrap" style={{ fontSize: max, lineHeight: 1.2 }}>
        {text || '\u00A0'}
      </span>
    </div>
  );
}

// Todas las filas de una etiqueta son celdas de UNA sola cuadrícula:
// [etiqueta | línea A | "of" | línea B]. La 1ª columna mide lo que la palabra más larga
// ("Weighed", "Formula", "Batches"), así todas las líneas arrancan en el mismo punto.
const LINE = 'border-b-[3px] border-black text-center font-bold pb-0.5';
const LABEL = 'label-text pr-3.5';
const FIELD_MAX = 66; // tamaño de los valores de las filas principales
const DATE_MAX = 64;

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
function Field({ label, value, max = FIELD_MAX }) {
  return (
    <>
      <span className={LABEL}>{label}</span>
      <FitText text={value} max={max} lock className={`col-span-3 ${LINE}`} />
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

/** Fila de la fecha, con el logo a la derecha (Preweigh y Missing). */
function DateRow({ data, logo, onLogoClick }) {
  return (
    <>
      <span className={`${LABEL} leading-[1.02]`}>Date<br />Weighed</span>
      <FitText text={data.date} max={DATE_MAX} lock className={`col-span-2 ${LINE}`} />
      <div onClick={onLogoClick} className="cursor-pointer pl-6" title="Logo">
        <Logo logo={logo} />
      </div>
    </>
  );
}

/** Logo en la esquina superior derecha (hojas de Refer). Reserva la franja superior con REFER_TOP. */
const REFER_TOP = 116;
function LogoCorner({ logo, onLogoClick }) {
  return (
    <div onClick={onLogoClick} className="absolute top-[36px] right-[56px] w-[280px] cursor-pointer" title="Logo">
      <Logo logo={logo} />
    </div>
  );
}

/** "Number Pallet … of …": fila deliberadamente más pequeña que las demás. */
function PalletRow({ data }) {
  return (
    <>
      <span className="label-text-sm pr-3.5">Number Pallet</span>
      <FitText text={data.palletNum} max={36} lock className={LINE} />
      <span className="label-text-sm text-center">of</span>
      <FitText text={data.palletTotal} max={36} lock className={LINE} />
    </>
  );
}

/** "ID-" va siempre delante: el usuario solo escribe el código (G9FB71). */
export const stripId = (v) => String(v ?? '').trim().replace(/^ID[-\s]*/i, '').toUpperCase();
export const formatId = (v) => (stripId(v) ? `ID-${stripId(v)}` : '');

/**
 * Texto de "Batches": automático "3/12" (batch + total) o un texto manual (p. ej. "Pilot").
 * Así el número de batch se escribe una sola vez.
 */
export const batchesText = (d) => {
  if (d.batchesCustom) return String(d.batches ?? '').trim();
  const b = String(d.batch ?? '').trim();
  const total = String(d.batchTotal ?? '').trim();
  return b && total ? `${b}/${total}` : '';
};

/** Lista de ingredientes (uno por línea de texto) sin líneas vacías. */
export const toItems = (text) => String(text ?? '').split('\n').map((t) => t.trim()).filter(Boolean);

/**
 * Lista centrada que se adapta a la cantidad: 1 columna hasta 6 ítems, 2 hasta 14 y 3 después.
 * La altura de cada fila se reparte en el alto disponible para que siempre quepan.
 */
function ItemList({ items, area, maxFont, min = 14, weight = 'font-medium' }) {
  const cols = items.length <= 6 ? 1 : items.length <= 14 ? 2 : 3;
  const rows = Math.ceil(items.length / cols);
  const rowH = Math.min(maxFont * 1.25, area / Math.max(rows, 1));
  const font = Math.max(min, Math.floor(rowH / 1.25));
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
        <DateRow data={data} logo={logo} onLogoClick={onLogoClick} />
        <Field label="Formula" value={data.formula} />
        <Field label="Name" value={data.name} />
        <Field label="Batch#" value={data.batch} />
        <Field label="P.O.#" value={data.po} />
        <Field label="Batches" value={data.batches} />
        <PalletRow data={data} />
        <div className="col-span-4 grid grid-cols-2 gap-6 h-[84px]">
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

export function MissingTag({ data, logo, onLogoClick }) {
  const items = toItems(data.missing);
  const many = items.length > 6; // lo normal son hasta 6 faltantes: una línea con rótulo para cada uno
  // Este tag es secundario: con más de 4 faltantes se achican los datos de arriba y los faltantes para que quepan
  const fieldMax = items.length > 4 ? 52 : 60;
  const itemMax = items.length > 4 ? 26 : 32;
  return (
    <div className="label-page flex flex-col">
      <TagGrid>
        <DateRow data={data} logo={logo} onLogoClick={onLogoClick} />
        <Field label="Name" value={data.name} max={fieldMax} />
        <Field label="Batch#" value={data.batch} max={fieldMax} />
        <Field label="P.O.#" value={data.po} max={fieldMax} />
        <Field label="Batches" value={data.batches} max={fieldMax} />
        <PalletRow data={data} />
        {!many &&
          items.map((t, i) => (
            <React.Fragment key={i}>
              <span className="text-[22px] font-medium tracking-wide pr-3.5 pb-1 whitespace-nowrap">MISSING INGREDIENT</span>
              <FitText text={t} max={itemMax} lock className="col-span-3 border-b-[3px] border-black font-medium pb-0.5" />
            </React.Fragment>
          ))}
        {many && (
          <div className="col-span-4">
            <MissingMany items={items} area={170} />
          </div>
        )}
      </TagGrid>
    </div>
  );
}

function MissingMany({ items, area }) {
  const cols = items.length <= 16 ? 2 : 3;
  const rows = Math.ceil(items.length / cols);
  const rowH = Math.min(46, Math.floor(area / rows));
  const font = Math.max(12, Math.floor(rowH * 0.7));
  return (
    <div>
      <div className="text-[24px] font-bold tracking-wide mb-1">MISSING INGREDIENTS</div>
      <div className="grid gap-x-8" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoFlow: 'column', gridTemplateRows: `repeat(${rows}, ${rowH}px)` }}>
        {items.map((t, i) => (
          <FitText key={i} text={t} max={font} min={11} className="border-b-2 border-black font-medium" />
        ))}
      </div>
    </div>
  );
}

export function ReferPage1({ data, logo, onLogoClick }) {
  const items = toItems(data.refer);
  const batchLine = [data.formula, data.name, data.batches].filter(Boolean).join(' ');
  return (
    <div className="label-page flex flex-col items-center text-center" style={{ paddingTop: REFER_TOP }}>
      <LogoCorner logo={logo} onLogoClick={onLogoClick} />
      <div className="text-[84px] font-black leading-none">{data.ile || 'ILE'}</div>
      <div className="text-[92px] font-black leading-none mt-3">KEEP IN REFER:</div>
      <div className="flex-1 w-full flex items-center pt-4 pb-4">
        <ItemList items={items} area={215} maxFont={60} min={16} />
      </div>
      <div className="w-full">
        <div className="text-[62px] font-black leading-tight">BATCH:</div>
        <FitText text={batchLine} max={60} min={22} className="font-black text-center" />
        <FitText text={formatId(data.identifier)} max={48} className="font-black text-center" />
      </div>
    </div>
  );
}

export function ReferPage2({ data, logo, onLogoClick }) {
  const items = toItems(data.refer);
  const compact = items.length > 4; // con muchos ítems el título se achica para dejar espacio
  const title = compact ? 84 : 112;
  return (
    <div className="label-page flex flex-col items-center text-center" style={{ paddingTop: REFER_TOP }}>
      <LogoCorner logo={logo} onLogoClick={onLogoClick} />
      <div className="font-black leading-none" style={{ fontSize: title }}>ITEMS IN</div>
      <div className="font-black leading-none" style={{ fontSize: title, marginTop: compact ? 14 : 36 }}>REFER {data.ile || 'ILE'}</div>
      <div className="flex-1 w-full flex items-center pt-4">
        <ItemList items={items} area={compact ? 380 : 280} maxFont={68} min={16} />
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
export function buildSheets(rawData, { pallets, withMissing, withRefer }) {
  const data = { ...rawData, batches: batchesText(rawData) };
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
