import Papa from 'papaparse';

const norm = (s) => String(s ?? '').trim();

/** Lee un CSV (texto o File) con columnas Formula, Name y, opcional, ILE. */
export function parseFormulasCsv(input, onDone) {
  Papa.parse(input, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.replace(/^﻿/, '').trim().toLowerCase(),
    complete: ({ data: rows }) =>
      onDone(
        rows
          .map((r) => ({ formula: norm(r.formula), name: norm(r.name), ile: norm(r.ile) }))
          .filter((r) => r.formula)
      ),
  });
}

export function formulasToCsv(list) {
  return Papa.unparse(
    list.map((f) => ({ Formula: f.formula, Name: f.name, ILE: f.ile || '' })),
    { columns: ['Formula', 'Name', 'ILE'] }
  );
}

export function downloadText(filename, text, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob(['﻿' + text], { type }));
  Object.assign(document.createElement('a'), { href: url, download: filename }).click();
  URL.revokeObjectURL(url);
}
