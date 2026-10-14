import React, { createContext, useContext } from 'react';

// Grosor extra (unidades del SVG, 1 punto de la impresora = 1.23) que se suma al contorno de letras y líneas.
// Compensa que el navegador imprime los bordes suavizados (grises) y el driver los vuelve puntos tenues.
const Boost = createContext(0);

// Etiqueta de ingrediente 4in x 2in (Datamax M-Class Mark II, 203 dpi). Es un SVG de 1000 x 500 unidades
// (250 unidades por pulgada), así se imprime con el tamaño exacto con cualquier driver y escala sin perder nitidez.
// Las posiciones salen de la etiqueta original de Label View 2022.
export const ING_W_IN = 4;
export const ING_H_IN = 2;

const FONT = 'Arial, Helvetica, sans-serif';
let ctx = null;
const measure = (text, size, bold) => {
  ctx = ctx || document.createElement('canvas').getContext('2d');
  ctx.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`;
  return ctx.measureText(text).width;
};

/** Tamaño de letra que hace caber `text` en `maxW` (sin pasar de `base` ni bajar de `min`). */
function fit(text, maxW, base, bold, min = 16) {
  const w = measure(text, base, bold);
  return w <= maxW ? { size: base } : { size: Math.max(min, Math.floor((base * maxW) / w)), squeeze: maxW };
}

function T({ x, y, children, size = 36, bold = false, anchor = 'start', maxW }) {
  const text = String(children ?? '');
  const f = maxW ? fit(text, maxW, size, bold) : { size };
  const w = measure(text, f.size, bold);
  // Si ni con el tamaño mínimo cabe, se comprime el texto en vez de salirse de la etiqueta
  const squeeze = f.squeeze && w > f.squeeze ? { textLength: f.squeeze, lengthAdjust: 'spacingAndGlyphs' } : {};
  const boost = useContext(Boost);
  return (
    <text x={x} y={y} fontSize={f.size} fontWeight={bold ? 700 : 400} textAnchor={anchor} fontFamily={FONT} fill="#000"
      stroke={boost ? '#000' : undefined} strokeWidth={boost || undefined} strokeLinejoin="round" {...squeeze}>
      {text}
    </text>
  );
}

function Line({ x1, x2, y }) {
  const boost = useContext(Boost);
  return <line x1={x1} x2={x2} y1={y + 5} y2={y + 5} stroke="#000" strokeWidth={2.5 + boost * 1.5} />;
}

export default function IngredientLabel({ name, part, seq, desc, container = 1, of = 1, width = '100%', height, boost = 0 }) {
  const lotRow = (y, dx = 0) => (
    <g key={y}>
      <T x={48 + dx} y={y}>Lot:</T>
      <Line x1={115 + dx} x2={348} y={y} />
      <T x={358} y={y}>Qty:</T>
      <Line x1={433} x2={606} y={y} />
      <T x={618} y={y}>Exp:</T>
      <Line x1={696} x2={931} y={y} />
    </g>
  );

  return (
    <Boost.Provider value={boost}>
    <svg viewBox="0 0 1000 500" width={width} height={height} xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', background: '#fff' }}>
      <T x={48} y={46} size={44} bold maxW={905}>{`NAME: ${name || ''}`}</T>

      <T x={48} y={98}>Item Code :</T>
      <Line x1={240} x2={511} y={98} />
      <T x={250} y={94} bold maxW={255}>{part}</T>
      <T x={522} y={98}>Seq #</T>
      <Line x1={622} x2={778} y={98} />
      <T x={700} y={92} size={46} bold anchor="middle" maxW={150}>{seq}</T>

      <T x={48} y={146}>Description:</T>
      <Line x1={231} x2={931} y={146} />
      <T x={240} y={140} size={40} bold maxW={685}>{desc}</T>

      {lotRow(188)}
      {lotRow(234)}
      {lotRow(280, 3)}

      <T x={50} y={338}>Container Number</T>
      <Line x1={340} x2={455} y={338} />
      <T x={398} y={332} size={40} bold anchor="middle">{container}</T>
      <T x={466} y={338}>OF</T>
      <Line x1={514} x2={631} y={338} />
      <T x={572} y={332} size={40} bold anchor="middle">{of}</T>
      <T x={641} y={338}>PB Lot #</T>
      <Line x1={785} x2={940} y={338} />

      <T x={53} y={384}>Total Weight :</T>
      <Line x1={275} x2={488} y={384} />

      <T x={251} y={430}>Weighed By :</T>
      <Line x1={466} x2={621} y={430} />
      <T x={631} y={430}>Verified By :</T>
      <Line x1={818} x2={955} y={430} />

      <T x={48} y={474} size={22}>Innovative Labs</T>
    </svg>
    </Boost.Provider>
  );
}
