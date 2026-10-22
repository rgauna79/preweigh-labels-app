// Impresión directa a una impresora (por ejemplo la Datamax) con QZ Tray, un programa que corre en la PC.
// Sin QZ Tray la app imprime con el cuadro de diálogo normal del navegador.

const PRINTER_KEY = 'lm.printer';
export const QZ_DOWNLOAD = 'https://qz.io/download/';

export const getPrinter = () => {
  try { return localStorage.getItem(PRINTER_KEY) || ''; } catch { return ''; }
};
export const setPrinter = (name) => {
  try { name ? localStorage.setItem(PRINTER_KEY, name) : localStorage.removeItem(PRINTER_KEY); } catch { /* sin almacenamiento */ }
};

let qzPromise = null;
const lib = () => (qzPromise ||= import('qz-tray').then((m) => m.default || m));

const withTimeout = (p, ms, msg) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(msg)), ms))]);

/** Conecta con QZ Tray (si ya está conectado no hace nada). Falla si no está instalado/abierto. */
let connecting = null;
export async function connect() {
  const qz = await lib();
  if (qz.websocket.isActive()) return qz;
  connecting ||= withTimeout(qz.websocket.connect({ retries: 1, delay: 1 }), 15000, 'QZ_TIMEOUT').finally(() => { connecting = null; });
  await connecting;
  return qz;
}

export async function listPrinters() {
  const qz = await connect();
  const found = await qz.printers.find();
  return (Array.isArray(found) ? found : [found]).filter(Boolean).sort((a, b) => a.localeCompare(b));
}

/** Manda cada imagen (data URL PNG de 4 x 2 in a 203 dpi) a la impresora, sin diálogo. */
export async function printImages(printer, images) {
  const qz = await connect();
  const config = qz.configs.create(printer, {
    units: 'in', size: { width: 4, height: 2 }, margins: 0, density: 203, scaleContent: false, colorType: 'blackwhite', interpolation: 'nearest-neighbor',
  });
  const data = images.map((src) => ({ type: 'pixel', format: 'image', flavor: 'base64', data: src.replace(/^data:image\/\w+;base64,/, '') }));
  await qz.print(config, data);
}
