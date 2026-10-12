// Límites de los campos. Existen para que lo que se escribe siempre quepa en la etiqueta impresa.
export const LIMITS = {
  formula: 12,
  name: 60, // se imprime en hasta 2 renglones
  po: 120, // se imprime en hasta 3 renglones
  batch: 6,
  batchTotal: 3,
  batches: 20, // texto manual (p. ej. "Pilot")
  identifier: 8, // lo que va después de "ID-"
  ile: 6,
  missing: { lines: 8, chars: 45 },
  refer: { lines: 10, chars: 50 },
};

/** Recorta cada línea a `chars` y el total a `lines` renglones (el renglón vacío al final también cuenta). */
export function clampList(value, { lines, chars }) {
  return String(value ?? '')
    .split('\n')
    .map((l) => l.slice(0, chars))
    .slice(0, lines)
    .join('\n');
}

/** Al salir del campo: sin espacios sobrantes ni renglones vacíos. */
export function tidyList(value) {
  return String(value ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n');
}

export const countLines = (value) => String(value ?? '').split('\n').filter((l) => l.trim()).length;
