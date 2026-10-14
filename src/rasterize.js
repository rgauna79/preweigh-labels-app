import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import IngredientLabel from './IngredientLabel.jsx';

// La Datamax M-Class imprime a 203 dpi: una etiqueta de 4 x 2 in son 812 x 406 puntos.
// En vez de dejar que el navegador y el driver reduzcan un dibujo vectorial (bordes grises, huecos),
// se genera un mapa de bits de exactamente esos puntos, en blanco y negro puro, y se imprime 1 a 1.
export const DPI = 203;
export const BITMAP_W = 4 * DPI; // 812
export const BITMAP_H = 2 * DPI; // 406
const SUPER = 4; // se dibuja 4 veces más grande y se reduce, para que el contorno de cada letra quede limpio

// Umbral (0-255): más alto = más puntos negros = trazo más grueso
export const THRESHOLDS = [120, 150, 180, 210];

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not render the label'));
    img.src = src;
  });

/** Devuelve un PNG (data URL) de 812 x 406 en blanco y negro puro. dx/dy: desplazamiento en puntos. */
export async function labelBitmap(props, { threshold = 150, dx = 0, dy = 0 } = {}) {
  const markup = renderToStaticMarkup(
    React.createElement(IngredientLabel, { ...props, width: BITMAP_W * SUPER, height: BITMAP_H * SUPER })
  );
  const svg = markup.includes('xmlns=') ? markup : markup.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = await loadImage(url);
    const big = document.createElement('canvas');
    big.width = BITMAP_W * SUPER;
    big.height = BITMAP_H * SUPER;
    const bctx = big.getContext('2d');
    bctx.fillStyle = '#fff';
    bctx.fillRect(0, 0, big.width, big.height);
    bctx.drawImage(img, 0, 0, big.width, big.height);

    const out = document.createElement('canvas');
    out.width = BITMAP_W;
    out.height = BITMAP_H;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, BITMAP_W, BITMAP_H);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(big, Math.round(dx), Math.round(dy), BITMAP_W, BITMAP_H);

    const px = ctx.getImageData(0, 0, BITMAP_W, BITMAP_H);
    const d = px.data;
    for (let i = 0; i < d.length; i += 4) {
      const lum = 255 - (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114); // 0 = blanco, 255 = negro
      const v = lum >= 255 - threshold ? 0 : 255;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
    ctx.putImageData(px, 0, 0);
    return out.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}
