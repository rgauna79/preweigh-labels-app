import Papa from 'papaparse';

export const PART_MAX = 30;
export const DESC_MAX = 80;

const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

/**
 * Lee texto pegado desde Excel (tabulador) o un CSV: dos columnas Part y Description/Name.
 * Con o sin fila de títulos. Los saltos de línea dentro de una celda (comunes al copiar de Excel) se limpian.
 * Devuelve { items, dupes, bad } donde items = [{ part, description }] sin repetidos (gana el último).
 */
export function parsePartsText(text) {
  const { data } = Papa.parse(String(text ?? '').replace(/^﻿/, ''), { skipEmptyLines: true, delimitersToGuess: ['\t', ',', ';', '|'] });
  let rows = data.filter((r) => Array.isArray(r));
  const head = rows[0]?.map((c) => clean(c).toLowerCase()) || [];
  const isHeader = head.some((h) => /^(part( ?(number|no\.?|#))?|item( code)?|código|codigo)$/.test(h));
  let pi = 0;
  let di = 1;
  if (isHeader) {
    pi = Math.max(0, head.findIndex((h) => /^(part|item|c[oó]digo)/.test(h)));
    di = head.findIndex((h) => /^(desc|name|nombre)/.test(h));
    if (di < 0) di = pi === 0 ? 1 : 0;
    rows = rows.slice(1);
  }
  const map = new Map();
  let dupes = 0;
  const bad = [];
  rows.forEach((r) => {
    const part = clean(r[pi]);
    const description = clean(r[di]);
    if (!part) return;
    if (part.length > PART_MAX || description.length > DESC_MAX) { bad.push({ part, description }); return; }
    const k = part.toLowerCase();
    if (map.has(k)) dupes++;
    map.set(k, { part, description });
  });
  return { items: [...map.values()], dupes, bad };
}

/** Números de parte que no son 6 dígitos exactos (sufijos como "700033 A", o un dígito de más/menos). */
export const oddPart = (part) => !/^\d{6}$/.test(part);
