import { createContext, createElement, useContext, useEffect, useState } from 'react';

// Solo se traduce la interfaz. El texto de los tags impresos no cambia nunca.
const STRINGS = {
  en: {
    subtitle: 'Pre-weigh tags',
    new: 'New', newTitle: 'New batch (clears the fields)',
    'sec.batch': 'Batch', 'sec.pallets': 'Pallets', 'sec.missing': 'Missing ingredients',
    'sec.refer': 'Refrigerated ingredients', 'sec.formulas': 'Formulas', 'sec.logo': 'Logo (shared)',
    'ph.formula': 'Formula (e.g. 300909)', 'ph.date': 'Date MM/DD/YY',
    'ph.batchTotal': 'Total batches', 'batches.customPh': 'Custom text (e.g. Pilot)',
    'batches.custom': 'Edit text', 'batches.auto': 'Use automatic',
    'batches.over': 'Batch {b} is greater than the total ({t}). Fix it before printing.', nextBatchLast: 'You are on the last batch',
    nextBatch: 'Next batch', nextBatchTitle: 'Batch +1. Keeps formula, name, P.O. and total; clears the ID and the ingredients',
    today: 'Today', todayTitle: "Set today's date",
    saveFormula: 'Save formula for everyone', updateName: 'Update name for everyone',
    'status.new': 'Formula "{f}" is new: enter the name and it will be saved for everyone when you print.',
    'status.updated': 'Name of {f} updated.', 'status.saved': 'Formula {f} saved for everyone.',
    'status.logoUpdated': 'Logo updated for everyone.', 'status.logoRemoved': 'Logo removed.',
    'err.offline': 'No connection to the server: the shared list cannot be read.',
    'job.missing': 'Ingredients are missing (1 Missing tag per pallet)',
    'job.refer': 'Has refrigerated items (2 Refer sheets)',
    'list.hint': 'One per line:\n{example}', 'list.count': '{n} items. Only the lines you type are printed.',
    manage: 'Manage formulas', 'logo.upload': 'Upload logo', 'logo.change': 'Change logo', remove: 'Remove',
    'empty.prefix': 'Empty: {list}', 'empty.missing': 'Missing ingredients', 'empty.refer': 'Refrigerated ingredients',
    'print.one': 'Print 1 sheet', 'print.many': 'Print {n} sheets',
    'sheet.pre': 'Pallet {i} of {n} · Preweigh', 'sheet.mis': 'Pallet {i} of {n} · Missing',
    'sheet.ref1': 'Refer · For the refrigerated pallet', 'sheet.ref2': 'Refer · For the batch record',
    lang: 'Language', credit: 'Created by Roberto Gauna',
    // Formula manager
    'fm.title': 'Shared formulas ({n})', 'fm.close': 'Close', 'fm.search': 'Search code or name',
    'fm.add': 'Add', 'fm.import': 'Import CSV', 'fm.export': 'Export',
    'fm.colFormula': 'Formula', 'fm.colName': 'Name', 'fm.namePh': 'Product name',
    'fm.delete': 'Delete formula', 'fm.dup': 'Duplicate code', 'fm.confirmDelete': 'Delete formula {code} for everyone?',
    'fm.saved': 'Saved for everyone.', 'fm.notSaved': 'Not saved: {err}',
    'fm.importNone': 'No formulas found. The CSV needs the columns Formula and Name.',
    'fm.imported': '{n} formulas imported for everyone.',
    'fm.noResults': 'No results.', 'fm.noneYet': 'No formulas yet. Use "Add" or "Import CSV".',
    'fm.reading': 'Reading CSV…', 'fm.uploading': 'Saving {n} formulas for everyone…', 'fm.saving': 'Saving…',
    'fm.dismiss': 'Dismiss', 'fm.errorTitle': 'Something went wrong', 'fm.rowError': 'Not saved. Fix it and leave the field again to retry.',
    'fm.footer': 'Each change is saved when you leave the field and everyone using the app sees it.',
    // API / PIN
    'pin.prompt': 'The edit PIN is required:', 'err.cancelled': 'Cancelled', 'err.pin': 'Wrong or missing PIN',
    'err.readList': 'Could not read the formula list', 'err.server': 'Server error', 'err.network': 'No connection to the server. Check your internet and try again.',
    'err.not_image': 'The logo must be an image', 'err.too_big': 'Image is too large', 'err.no_db': 'The database is not connected to the project',
    'err.bad_op': 'Unknown operation', 'err.bad_json': 'Invalid request', 'err.not_found': 'Not found', 'err.method': 'Method not allowed',
    'err.image': 'Invalid image',
  },
  es: {
    subtitle: 'Tags de preweigh',
    new: 'Nuevo', newTitle: 'Nuevo batch (limpia los campos)',
    'sec.batch': 'Batch', 'sec.pallets': 'Pallets', 'sec.missing': 'Ingredientes faltantes',
    'sec.refer': 'Ingredientes refrigerados', 'sec.formulas': 'Fórmulas', 'sec.logo': 'Logo (compartido)',
    'ph.formula': 'Formula (ej. 300909)', 'ph.date': 'Fecha MM/DD/YY',
    'ph.batchTotal': 'Total de batches', 'batches.customPh': 'Texto manual (ej. Pilot)',
    'batches.custom': 'Editar texto', 'batches.auto': 'Usar automático',
    'batches.over': 'El batch {b} es mayor que el total ({t}). Corrígelo antes de imprimir.', nextBatchLast: 'Ya estás en el último batch',
    nextBatch: 'Siguiente batch', nextBatchTitle: 'Batch +1. Conserva fórmula, nombre, P.O. y total; borra el ID y los ingredientes',
    today: 'Hoy', todayTitle: 'Poner la fecha de hoy',
    saveFormula: 'Guardar fórmula para todos', updateName: 'Actualizar nombre para todos',
    'status.new': 'La fórmula "{f}" es nueva: escribe el nombre y se guardará para todos al imprimir.',
    'status.updated': 'Nombre de {f} actualizado.', 'status.saved': 'Fórmula {f} guardada para todos.',
    'status.logoUpdated': 'Logo actualizado para todos.', 'status.logoRemoved': 'Logo quitado.',
    'err.offline': 'Sin conexión con el servidor: no se puede leer la lista compartida.',
    'job.missing': 'Faltan ingredientes (1 tag Missing por pallet)',
    'job.refer': 'Lleva refrigerados (2 hojas Refer)',
    'list.hint': 'Uno por línea:\n{example}', 'list.count': '{n} ingredientes. Solo se imprimen las líneas que escribas.',
    manage: 'Administrar fórmulas', 'logo.upload': 'Subir logo', 'logo.change': 'Cambiar logo', remove: 'Quitar',
    'empty.prefix': 'Vacío: {list}', 'empty.missing': 'Ingredientes faltantes', 'empty.refer': 'Ingredientes refrigerados',
    'print.one': 'Imprimir 1 hoja', 'print.many': 'Imprimir {n} hojas',
    'sheet.pre': 'Pallet {i} de {n} · Preweigh', 'sheet.mis': 'Pallet {i} de {n} · Missing',
    'sheet.ref1': 'Refer · Para el pallet de refrigerados', 'sheet.ref2': 'Refer · Para el batch record',
    lang: 'Idioma', credit: 'Creado por Roberto Gauna',
    'fm.title': 'Fórmulas compartidas ({n})', 'fm.close': 'Cerrar', 'fm.search': 'Buscar código o nombre',
    'fm.add': 'Agregar', 'fm.import': 'Importar CSV', 'fm.export': 'Exportar',
    'fm.colFormula': 'Fórmula', 'fm.colName': 'Nombre', 'fm.namePh': 'Nombre del producto',
    'fm.delete': 'Borrar fórmula', 'fm.dup': 'Código repetido', 'fm.confirmDelete': '¿Borrar la fórmula {code} para todos?',
    'fm.saved': 'Guardado para todos.', 'fm.notSaved': 'No se guardó: {err}',
    'fm.importNone': 'No se encontraron fórmulas. El CSV necesita las columnas Formula y Name.',
    'fm.imported': '{n} fórmulas importadas para todos.',
    'fm.noResults': 'Sin resultados.', 'fm.noneYet': 'Aún no hay fórmulas. Usa "Agregar" o "Importar CSV".',
    'fm.reading': 'Leyendo CSV…', 'fm.uploading': 'Guardando {n} fórmulas para todos…', 'fm.saving': 'Guardando…',
    'fm.dismiss': 'Cerrar aviso', 'fm.errorTitle': 'Algo salió mal', 'fm.rowError': 'No se guardó. Corrígelo y sal del campo de nuevo para reintentar.',
    'fm.footer': 'Cada cambio se guarda al salir del campo y lo ven todas las personas que usan la app.',
    'pin.prompt': 'Se requiere el PIN de edición:', 'err.cancelled': 'Cancelado', 'err.pin': 'PIN incorrecto o requerido',
    'err.readList': 'No se pudo leer la lista de fórmulas', 'err.server': 'Error del servidor', 'err.network': 'Sin conexión con el servidor. Revisa tu internet e inténtalo de nuevo.',
    'err.not_image': 'El logo debe ser una imagen', 'err.too_big': 'Imagen demasiado grande', 'err.no_db': 'Falta conectar la base de datos al proyecto',
    'err.bad_op': 'Operación desconocida', 'err.bad_json': 'Solicitud inválida', 'err.not_found': 'No encontrado', 'err.method': 'Método no permitido',
    'err.image': 'Imagen no válida',
  },
};

const KEY = 'lm.lang';
const readLang = () => {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'es' || v === 'en' ? v : 'en'; // por defecto, inglés
  } catch {
    return 'en';
  }
};

let current = readLang();

/** Traducción fuera de React (por ejemplo en api.js). */
export function tr(key, vars = {}) {
  const text = STRINGS[current][key] ?? STRINGS.en[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`));
}

const LangContext = createContext({ lang: 'en', setLang: () => {}, t: tr });

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(current);
  current = lang;
  useEffect(() => {
    document.documentElement.lang = lang;
    try { localStorage.setItem(KEY, lang); } catch { /* sin almacenamiento */ }
  }, [lang]);
  return createElement(LangContext.Provider, { value: { lang, setLang: setLangState, t: tr } }, children);
}

export const useLang = () => useContext(LangContext);
