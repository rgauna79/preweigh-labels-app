import React, { useLayoutEffect, useRef, useState } from 'react';
import { LIMITS } from './limits.js';

// Etiqueta: 10.5in x 8in (a 96 dpi). Se imprime centrada en hoja Letter horizontal.
export const LABEL_W = 1008;
export const LABEL_H = 768;

/** Una coma o "&" suelto ("A-1 , B-2 & C-3") se pega a la palabra anterior para no quedar al inicio de un renglón. */
const glueSymbols = (words) =>
  words.reduce((out, w) => {
    if (out.length && /^[,;&]+$/.test(w)) out[out.length - 1] += ` ${w}`;
    else out.push(w);
    return out;
  }, []);

export const MIN_SINGLE = 38; // tamaño mínimo (px) al que se achica una línea antes de pasar a otro renglón

/**
 * Texto que se ajusta al ancho disponible.
 * - Una línea: se achica hasta caber.
 * - lines > 1: se achica solo hasta MIN_SINGLE; si aún no cabe, pasa a otro renglón (hasta `lines`)
 *   con la letra más grande que quepa. Las palabras / códigos nunca se parten.
 */
export function FitText({ text, max, min = 14, className = '', style, lock = false, lines = 1 }) {
  const boxRef = useRef(null);
  const innerRef = useRef(null);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const inner = innerRef.current;
    if (!box || !inner) return;
    const fit = () => {
      inner.style.whiteSpace = 'nowrap';
      inner.style.display = 'inline-block';
      inner.style.width = '';
      inner.style.overflowWrap = 'normal';
      inner.querySelectorAll('span').forEach((w) => { w.style.whiteSpace = 'nowrap'; }); // palabras enteras
      inner.style.fontSize = `${max}px`;
      const avail = box.clientWidth;
      const need = inner.scrollWidth;
      if (!(avail > 0 && need > avail)) return;
      const single = Math.floor((max * avail) / need) - 1;
      const floor = Math.min(max, MIN_SINGLE);
      if (lines < 2 || single >= floor) {
        inner.style.fontSize = `${Math.max(min, single)}px`;
        return;
      }
      // Otro renglón: la letra más grande (hasta el límite) que quepa en `lines` renglones
      inner.style.whiteSpace = 'normal';
      inner.style.display = 'block';
      inner.style.width = '100%';
      let f = floor;
      for (; f > min; f -= 1) {
        inner.style.fontSize = `${f}px`;
        if (inner.scrollHeight <= f * 1.2 * lines + 2 && inner.scrollWidth <= avail + 1) break;
      }
      inner.style.fontSize = `${f}px`;
      // Último recurso (una "palabra" más ancha que la línea): se permite partirla antes que cortarla
      if (inner.scrollWidth > avail + 1) {
        inner.style.overflowWrap = 'anywhere';
        inner.querySelectorAll('span').forEach((w) => { w.style.whiteSpace = 'normal'; });
      }
    };
    fit();
    document.fonts?.ready.then(fit);
    // Si cambia el ancho de la casilla (p. ej. otra fila hace crecer la columna de títulos), se vuelve a ajustar
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
    ro?.observe(box);
    return () => ro?.disconnect();
  }, [text, max, min, lines]);

  // lock: alto según el tamaño máximo, para que una fila no se encoja cuando su texto se reduce.
  // Con lines > 1 es un alto mínimo: la fila crece solo si el texto necesita más renglones.
  const lockStyle = lock
    ? {
        [lines > 1 ? 'minHeight' : 'height']: Math.ceil(max * 1.2),
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: /text-center/.test(className) ? 'center' : 'flex-start',
      }
    : null;

  return (
    <div ref={boxRef} className={`overflow-hidden ${/(^|\s)w-/.test(className) ? '' : 'w-full'} ${className}`} style={{ ...lockStyle, ...style }}>
      <span ref={innerRef} className="inline-block whitespace-nowrap" style={{ fontSize: max, lineHeight: 1.2 }}>
        {lines > 1 && text
          ? glueSymbols(text.split(' ')).map((w, i, arr) => (
              <React.Fragment key={i}>
                <span style={{ whiteSpace: 'nowrap' }}>{w}</span>
                {i < arr.length - 1 ? ' ' : null}
              </React.Fragment>
            ))
          : text || '\u00A0'}
      </span>
    </div>
  );
}

/** Renglones máximos [Name, P.O.] por nivel; se baja de nivel solo si el contenido no cabe en la hoja. */
const WRAP_LEVELS = [[2, 3], [2, 2], [1, 2], [1, 1]];

function useWrapGuard(deps) {
  const rootRef = useRef(null);
  const [level, setLevel] = useState(0);
  useLayoutEffect(() => { setLevel(0); }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const root = rootRef.current;
    const grid = root?.firstElementChild;
    if (!root || !grid || level >= WRAP_LEVELS.length - 1) return;
    if (grid.offsetHeight > root.clientHeight - 72 + 1) setLevel((l) => l + 1);
  });
  return [rootRef, WRAP_LEVELS[level]];
}

// Todas las filas de una etiqueta son celdas de UNA sola cuadrícula:
// [etiqueta | línea A | "of" | línea B]. La 1ª columna mide lo que la palabra más larga
// ("Weighed", "Formula", "Batches"), así todas las líneas arrancan en el mismo punto.
const LINE = 'border-b-[3px] border-black text-center font-bold pb-0.5';
const LABEL = 'label-text pr-3.5';
const FIELD_MAX = 68; // tamaño de los valores de las filas principales
const DATE_MAX = 66;
const MISSING_FIELD_MAX = 56; // el Missing es secundario: un poco más pequeño que el principal para dejar sitio a la lista

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
function Field({ label, value, max = FIELD_MAX, lines = 1 }) {
  return (
    <>
      <span className={LABEL}>{label}</span>
      <FitText text={value} max={max} lock lines={lines} className={`col-span-3 ${LINE}`} />
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

/** "1 of 3": número de este pallet y total de pallets del batch. */
const palletText = (d) => `${d.palletNum} of ${d.palletTotal}`;

/** Franja inferior del tag principal: ILE | ID | PALLET. */
function IdentityStrip({ data, height = 92 }) {
  return (
    <div className="col-span-4 grid gap-4" style={{ gridTemplateColumns: '0.8fr 1.5fr 1.15fr', height }}>
      <div className="border-[3px] border-black flex items-center px-3">
        <FitText text={data.ile} max={56} className="text-center font-black" />
      </div>
      <div className="border-[3px] border-black flex items-center px-3">
        <FitText text={formatId(data.identifier)} max={56} className="text-center font-black" />
      </div>
      <div className="border-[3px] border-black flex flex-col items-center justify-center px-3">
        <span className="text-[20px] font-bold leading-none tracking-[0.18em]">PALLET</span>
        <FitText text={palletText(data)} max={50} className="text-center font-black" />
      </div>
    </div>
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

/** Lista de ingredientes (uno por línea de texto) sin líneas vacías y con el tope de renglones y de largo. */
export const toItems = (text, { lines = Infinity, chars = Infinity } = {}) =>
  String(text ?? '').split('\n').map((t) => t.trim().slice(0, chars)).filter(Boolean).slice(0, lines);

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
  const [rootRef, [nameLines, poLines]] = useWrapGuard([data.name, data.po]);
  return (
    <div ref={rootRef} className="label-page flex flex-col">
      <TagGrid>
        <DateRow data={data} logo={logo} onLogoClick={onLogoClick} />
        <Field label="Formula" value={data.formula} />
        <Field label="Name" value={data.name} lines={nameLines} />
        <Field label="Batch#" value={data.batch} />
        <Field label="P.O.#" value={data.po} lines={poLines} />
        <Field label="Batches" value={data.batches} />
        <IdentityStrip data={data} />
      </TagGrid>
    </div>
  );
}

/** Faltantes: un encabezado y líneas numeradas (1 columna hasta 4, 2 columnas hasta 8). */
function MissingList({ items }) {
  const cols = items.length > 4 ? 2 : 1;
  const rows = Math.ceil(items.length / cols);
  return (
    <div className="col-span-4">
      <div className="mb-1 text-[22px] font-bold leading-none tracking-wide">MISSING INGREDIENTS</div>
      <div className="grid gap-x-8" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoFlow: 'column', gridTemplateRows: `repeat(${rows}, 38px)` }}>
        {items.map((t, i) => (
          <div key={i} className="flex items-end gap-2 border-b-[3px] border-black">
            <span className="w-7 shrink-0 pb-0.5 text-[20px] font-bold leading-none text-slate-500">{i + 1}</span>
            <FitText text={t} max={26} min={12} className="font-medium pb-0.5" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function MissingTag({ data, logo, onLogoClick }) {
  const items = toItems(data.missing, LIMITS.missing);
  const [rootRef, [nameLines, poLines]] = useWrapGuard([data.name, data.po, data.missing]);
  return (
    <div ref={rootRef} className="label-page flex flex-col">
      <TagGrid>
        <DateRow data={data} logo={logo} onLogoClick={onLogoClick} />
        <Field label="Name" value={data.name} max={MISSING_FIELD_MAX} lines={nameLines} />
        <Field label="Batch#" value={data.batch} max={MISSING_FIELD_MAX} />
        <Field label="P.O.#" value={data.po} max={MISSING_FIELD_MAX} lines={poLines} />
        <Field label="Batches" value={data.batches} max={MISSING_FIELD_MAX} />
        {/* Missing es una hoja temporal: solo lleva el pallet (sin ILE ni ID), como una fila más */}
        <Field label="Pallet" value={palletText(data)} max={MISSING_FIELD_MAX} />
        {items.length > 0 && <MissingList items={items} />}
      </TagGrid>
    </div>
  );
}

/** Línea de identificación de las hojas Refer: "300297 YGLV Ningxia Red JP 2/4" + "ID-AED739". */
const referBatchLine = (d) => [d.formula, d.name, d.batches].filter(Boolean).join(' ');

export function ReferPage1({ data, logo, onLogoClick }) {
  const items = toItems(data.refer, LIMITS.refer);
  return (
    <div className="label-page flex flex-col items-center text-center" style={{ paddingTop: REFER_TOP }}>
      <LogoCorner logo={logo} onLogoClick={onLogoClick} />
      <div className="text-[76px] font-black leading-none">{data.ile || 'ILE'}</div>
      <div className="mt-2 text-[84px] font-black leading-none">KEEP IN REFER:</div>
      <div className="flex-1 w-full flex items-center pt-3 pb-3">
        <ItemList items={items} area={190} maxFont={60} min={16} />
      </div>
      <div className="w-full">
        <div className="text-[54px] font-black leading-tight">BATCH:</div>
        <FitText text={referBatchLine(data)} max={54} min={22} className="font-black text-center" />
        <FitText text={formatId(data.identifier)} max={48} className="font-black text-center" />
      </div>
    </div>
  );
}

/** Esta hoja se anexa al batch record: lleva la misma identificación que la hoja 1 para no perder a qué batch pertenece. */
export function ReferPage2({ data, logo, onLogoClick }) {
  const items = toItems(data.refer, LIMITS.refer);
  const compact = items.length > 4; // con muchos ítems el título se achica para dejar espacio
  const title = compact ? 84 : 112;
  return (
    <div className="label-page flex flex-col items-center text-center" style={{ paddingTop: REFER_TOP }}>
      <LogoCorner logo={logo} onLogoClick={onLogoClick} />
      <div className="font-black leading-none" style={{ fontSize: title }}>ITEMS IN</div>
      <div className="font-black leading-none" style={{ fontSize: title, marginTop: compact ? 14 : 36 }}>REFER {data.ile || 'ILE'}</div>
      <div className="flex-1 w-full flex items-center pt-3 pb-3">
        <ItemList items={items} area={compact ? 290 : 200} maxFont={68} min={16} />
      </div>
      <div className="w-full border-t-[3px] border-black pt-2">
        <FitText text={referBatchLine(data)} max={44} min={20} className="font-black text-center" />
        <FitText text={formatId(data.identifier)} max={40} className="font-black text-center" />
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
    sheets.push({ key: `pre${i}`, label: ['sheet.pre', { i, n }], short: ['chip.pre', { i }], Comp: PreweighTag, data: d });
    if (withMissing) {
      sheets.push({ key: `mis${i}`, label: ['sheet.mis', { i, n }], short: ['chip.mis', { i }], Comp: MissingTag, data: d });
    }
  }
  if (withRefer) {
    sheets.push({ key: 'ref1', label: ['sheet.ref1'], short: ['chip.ref1'], Comp: ReferPage1, data });
    sheets.push({ key: 'ref2', label: ['sheet.ref2'], short: ['chip.ref2'], Comp: ReferPage2, data });
  }
  return sheets;
}
