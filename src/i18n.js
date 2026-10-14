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
    'limit.count': '{n}/{max} characters', 'limit.reached': '{n}/{max} · limit reached. Shorten it.',
    nextBatch: 'Next batch', nextBatchTitle: 'Batch +1. Keeps everything (formula, P.O., total, missing and refrigerated lists) and clears only the ID',
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
    // Fase 1: títulos y límites
    'lbl.formula': 'Formula', 'lbl.name': 'Name', 'lbl.batch': 'Batch #', 'lbl.total': 'Total batches', 'lbl.po': 'P.O. #',
    'lbl.date': 'Date weighed', 'lbl.id': 'ID', 'lbl.ile': 'ILE',
    'list.lines': '{n}/{max} lines', 'list.full': '{max}/{max} lines · limit reached', 'list.chars': 'up to {max} characters each',
    // Fases 2-4: deshacer, historial, ajustes, confirmación
    undo: 'Undo', 'toast.cleared': 'Fields cleared', 'toast.next': 'Moved to batch {b}', 'toast.loaded': 'Loaded {f} · batch {b}',
    'err.too_long': 'A value is too long', 'err.too_many': 'Too many items', 'err.db_error': 'Database error',
    'hist.btn': 'History', 'hist.title': 'Recent batches', 'hist.search': 'Search formula, name, ID or batch', 'hist.empty': 'Nothing printed yet.',
    'hist.noResults': 'No results.', 'hist.load': 'Load', 'hist.date': 'Date', 'hist.formula': 'Formula', 'hist.batch': 'Batch', 'hist.id': 'ID',
    'hist.pallets': 'Pallets', 'hist.by': 'By', 'hist.error': 'Could not read the history.',
    'hist.footer': 'The last 200 prints from everyone using the app. “Load” fills the form with that batch so you can reprint it.',
    'id.clash': '{id} was already used for formula {f}, batch {b} on {d}.', 'id.again': 'Already printed on {d} (same formula, batch and ID).',
    'settings.btn': 'Settings', 'settings.title': 'Settings', 'settings.formulas': 'Formulas', 'settings.formulasDesc': 'Add, edit or import the shared formula list.',
    'settings.logo': 'Logo', 'settings.by': 'Your name', 'settings.byHint': 'Shown in the history next to each print (optional).',
    'settings.stamp': 'Print date and time on each sheet', 'settings.stampHint': 'A small line at the bottom of every printed sheet.',
    copies: 'Copies of each sheet',
    'confirm.title': 'Check before printing', 'confirm.summary': '{n} sheets will print', 'confirm.summaryOne': '1 sheet will print', 'confirm.fix': 'Go back and fix', 'confirm.print': 'Print anyway',
    breakdown: '{pre} Preweigh · {mis} Missing · {ref} Refer',
    'chk.empty': 'Empty: {list}', 'chk.over': 'Batch {b} is greater than the total ({t}).',
    'chk.idLen': 'The ID usually has 6 characters (this one has {n}).', 'chk.formulaFmt': 'The formula is usually 6 digits.',
    'chk.limit': '{what} is over its limit and will be cut.',
    'chip.pre': 'P{i} · Preweigh', 'chip.mis': 'P{i} · Missing', 'chip.ref1': 'Refer 1', 'chip.ref2': 'Refer 2',
    stamp: 'Printed {d} {h}',
    // Etiquetas de ingredientes
    'ing.open': 'Ingredient labels', 'ing.openTitle': 'Print the 4 x 2 labels of a formula', 'ing.back': 'Back', 'ing.title': 'Ingredient labels', 'ing.subtitle': 'Type a formula and print its labels (4 × 2 in)',
    'ing.start': 'Type a formula number to see or create its ingredient list.', 'ing.empty': 'No ingredients yet. Add them one by one or paste them from Excel.',
    'ing.noList': 'Formula {f} has no ingredient list yet. Build it once and it stays saved for everyone.', 'ing.namePh': 'Formula name (new formula)',
    'ing.part': 'Part number', 'ing.desc': 'Description', 'ing.print': 'Print', 'ing.remove': 'Remove', 'ing.add': 'Ingredient', 'ing.paste': 'Paste from Excel', 'ing.pasteAdd': 'Add rows',
    'ing.pastePh': 'One ingredient per line, from Excel:\npart number ⇥ description\n(Seq # is assigned 10, 20, 30…)', 'ing.import': 'Import catalog', 'ing.importHint': 'CSV with the columns Part and Description',
    'ing.importNone': 'Nothing found. The CSV needs the columns Part and Description.', 'ing.imported': '{n} part numbers imported for everyone.',
    'ing.save': 'Save for everyone', 'ing.upToDate': 'Saved', 'ing.saved': 'Ingredient list saved for everyone.', 'ing.needName': 'Type the formula name first', 'ing.unsaved': 'Unsaved changes. They are printed, but save them so everyone gets them.',
    'ing.badSeq': 'Every Seq # must be a whole number.', 'ing.dupSeq': 'Two ingredients have the same Seq #.',
    'ing.preview': 'Preview', 'ing.copies': 'Copies of each label', 'ing.all': 'Select all', 'ing.none': 'Select none', 'ing.printOne': 'Print 1 label', 'ing.printMany': 'Print {n} labels',
    'ing.calib': 'Printer alignment', 'ing.calibHelp': 'If the print is shifted on the label, move it here (millimetres, positive = right / down). Set paper to 4 × 2 in, scale 100% and margins none in the print dialog.',
    'ing.dark': 'Print weight', 'ing.dark0': 'Normal', 'ing.dark1': 'Dark', 'ing.dark2': 'Darker', 'ing.dark3': 'Maximum', 'ing.darkHelp': 'Also raise Darkness in the Datamax driver (Printing Preferences → Options) and lower the speed.', 'ing.offX': 'Horizontal (mm)', 'ing.offY': 'Vertical (mm)', 'ing.test': 'Print test label',
    'err.bad_seq': 'Every Seq # must be a whole number.', 'err.dup_seq': 'Two ingredients have the same Seq #.', 'err.exists': 'This formula already has a list. Editing it needs the PIN.',
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
    'limit.count': '{n}/{max} caracteres', 'limit.reached': '{n}/{max} · límite alcanzado. Resúmelo.',
    nextBatch: 'Siguiente batch', nextBatchTitle: 'Batch +1. Conserva todo (fórmula, P.O., total, faltantes y refrigerados) y borra solo el ID',
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
    // Fase 1: títulos y límites
    'lbl.formula': 'Fórmula', 'lbl.name': 'Nombre', 'lbl.batch': 'Batch #', 'lbl.total': 'Total de batches', 'lbl.po': 'P.O. #',
    'lbl.date': 'Fecha de pesado', 'lbl.id': 'ID', 'lbl.ile': 'ILE',
    'list.lines': '{n}/{max} líneas', 'list.full': '{max}/{max} líneas · límite alcanzado', 'list.chars': 'hasta {max} caracteres cada una',
    // Fases 2-4: deshacer, historial, ajustes, confirmación
    undo: 'Deshacer', 'toast.cleared': 'Campos borrados', 'toast.next': 'Pasaste al batch {b}', 'toast.loaded': 'Cargado {f} · batch {b}',
    'err.too_long': 'Un valor es demasiado largo', 'err.too_many': 'Demasiados elementos', 'err.db_error': 'Error de la base de datos',
    'hist.btn': 'Historial', 'hist.title': 'Batches recientes', 'hist.search': 'Buscar fórmula, nombre, ID o batch', 'hist.empty': 'Aún no se ha impreso nada.',
    'hist.noResults': 'Sin resultados.', 'hist.load': 'Cargar', 'hist.date': 'Fecha', 'hist.formula': 'Fórmula', 'hist.batch': 'Batch', 'hist.id': 'ID',
    'hist.pallets': 'Pallets', 'hist.by': 'Por', 'hist.error': 'No se pudo leer el historial.',
    'hist.footer': 'Las últimas 200 impresiones de todas las personas que usan la app. “Cargar” llena el formulario con ese batch para reimprimirlo.',
    'id.clash': '{id} ya se usó para la fórmula {f}, batch {b}, el {d}.', 'id.again': 'Ya se imprimió el {d} (misma fórmula, batch e ID).',
    'settings.btn': 'Ajustes', 'settings.title': 'Ajustes', 'settings.formulas': 'Fórmulas', 'settings.formulasDesc': 'Agrega, edita o importa la lista compartida de fórmulas.',
    'settings.logo': 'Logo', 'settings.by': 'Tu nombre', 'settings.byHint': 'Aparece en el historial junto a cada impresión (opcional).',
    'settings.stamp': 'Imprimir fecha y hora en cada hoja', 'settings.stampHint': 'Una línea pequeña al pie de cada hoja impresa.',
    copies: 'Copias de cada hoja',
    'confirm.title': 'Revisa antes de imprimir', 'confirm.summary': 'Se imprimirán {n} hojas', 'confirm.summaryOne': 'Se imprimirá 1 hoja', 'confirm.fix': 'Volver y corregir', 'confirm.print': 'Imprimir de todos modos',
    breakdown: '{pre} Preweigh · {mis} Missing · {ref} Refer',
    'chk.empty': 'Vacío: {list}', 'chk.over': 'El batch {b} es mayor que el total ({t}).',
    'chk.idLen': 'El ID suele tener 6 caracteres (este tiene {n}).', 'chk.formulaFmt': 'La fórmula suele tener 6 dígitos.',
    'chk.limit': '{what} supera su límite y se cortará.',
    'chip.pre': 'P{i} · Preweigh', 'chip.mis': 'P{i} · Missing', 'chip.ref1': 'Refer 1', 'chip.ref2': 'Refer 2',
    stamp: 'Impreso {d} {h}',
    // Etiquetas de ingredientes
    'ing.open': 'Etiquetas de ingredientes', 'ing.openTitle': 'Imprimir las etiquetas 4 x 2 de una fórmula', 'ing.back': 'Volver', 'ing.title': 'Etiquetas de ingredientes', 'ing.subtitle': 'Escribe una fórmula e imprime sus etiquetas (4 × 2 in)',
    'ing.start': 'Escribe el número de fórmula para ver o crear su lista de ingredientes.', 'ing.empty': 'Aún no hay ingredientes. Agrégalos uno por uno o pégalos desde Excel.',
    'ing.noList': 'La fórmula {f} todavía no tiene lista de ingredientes. Arma la lista una vez y queda guardada para todos.', 'ing.namePh': 'Nombre de la fórmula (fórmula nueva)',
    'ing.part': 'Número de parte', 'ing.desc': 'Descripción', 'ing.print': 'Imprimir', 'ing.remove': 'Quitar', 'ing.add': 'Ingrediente', 'ing.paste': 'Pegar desde Excel', 'ing.pasteAdd': 'Agregar filas',
    'ing.pastePh': 'Un ingrediente por línea, desde Excel:\nnúmero de parte ⇥ descripción\n(El Seq # se asigna 10, 20, 30…)', 'ing.import': 'Importar catálogo', 'ing.importHint': 'CSV con las columnas Part y Description',
    'ing.importNone': 'No se encontró nada. El CSV necesita las columnas Part y Description.', 'ing.imported': '{n} números de parte importados para todos.',
    'ing.save': 'Guardar para todos', 'ing.upToDate': 'Guardado', 'ing.saved': 'Lista de ingredientes guardada para todos.', 'ing.needName': 'Escribe primero el nombre de la fórmula', 'ing.unsaved': 'Hay cambios sin guardar. Se imprimen igual, pero guárdalos para que todos los tengan.',
    'ing.badSeq': 'Cada Seq # debe ser un número entero.', 'ing.dupSeq': 'Dos ingredientes tienen el mismo Seq #.',
    'ing.preview': 'Vista previa', 'ing.copies': 'Copias de cada etiqueta', 'ing.all': 'Marcar todas', 'ing.none': 'Quitar todas', 'ing.printOne': 'Imprimir 1 etiqueta', 'ing.printMany': 'Imprimir {n} etiquetas',
    'ing.calib': 'Alineación de la impresora', 'ing.calibHelp': 'Si la impresión sale corrida en la etiqueta, muévela aquí (milímetros, positivo = derecha / abajo). En el diálogo de impresión usa papel 4 × 2 in, escala 100% y sin márgenes.',
    'ing.dark': 'Grosor de impresión', 'ing.dark0': 'Normal', 'ing.dark1': 'Oscuro', 'ing.dark2': 'Más oscuro', 'ing.dark3': 'Máximo', 'ing.darkHelp': 'Sube también Darkness en el driver de la Datamax (Preferencias de impresión → Opciones) y baja la velocidad.', 'ing.offX': 'Horizontal (mm)', 'ing.offY': 'Vertical (mm)', 'ing.test': 'Imprimir etiqueta de prueba',
    'err.bad_seq': 'Cada Seq # debe ser un número entero.', 'err.dup_seq': 'Dos ingredientes tienen el mismo Seq #.', 'err.exists': 'Esta fórmula ya tiene lista. Editarla requiere el PIN.',
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
