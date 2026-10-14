# Pendientes

Lista de trabajo futuro de Label Master. Cada pendiente tiene su estado, el porqué, el plan y los criterios para darlo por terminado.

| # | Pendiente | Estado | Prioridad |
|---|-----------|--------|-----------|
| 1 | Editor de etiquetas compartido (plantillas) | Planificado, sin empezar | Por definir |
| 2 | Registrar en el historial las impresiones de ingredientes | Idea | Baja |
| 3 | Subir a `main` los cambios pendientes de la rama de trabajo | Revisar al retomar | — |

---

## 1. Editor de etiquetas compartido (plantillas)

### 1.1 Objetivo
Que cualquier persona autorizada pueda cambiar el diseño de la etiqueta de ingredientes (textos, posiciones, tamaños, líneas, campos) desde la app, sin tocar código ni abrir Label View. Los cambios se guardan **para todos**, igual que hoy las fórmulas y las listas de ingredientes.

### 1.2 Situación actual (punto de partida)
- La etiqueta de ingredientes 4×2 in está dibujada en código: `src/IngredientLabel.jsx`. Cada texto y línea tiene sus coordenadas escritas a mano en un SVG de 1000×500 unidades (250 unidades por pulgada).
- Los campos variables son fijos: nombre de fórmula, `#batch`, Item Code (part number), Seq #, Description y Container N OF M.
- Impresión: `src/rasterize.js` convierte el SVG en un bitmap de 812×406 px (203 dpi), en blanco y negro puro, y se imprime 1 a 1 con el driver de la Datamax. Esto ya está probado en la impresora real y **no debe cambiar**.
- Validación de textos largos: `checkLabel()` en `IngredientLabel.jsx` (estados `ok` / `small` / `cut`).
- Datos compartidos: Upstash Redis vía `api/[route].js`, con PIN opcional (`EDIT_PIN`).
- Ajustes locales de cada PC (alineación en mm, grosor, casilla del part number): `localStorage`.

### 1.3 Alcance
**Dentro:**
- Plantilla de etiqueta como datos (JSON), guardada en el servidor.
- Dibujo de la etiqueta leyendo la plantilla (misma salida de bitmap de hoy).
- Pantalla de edición con vista previa en vivo.
- Plantilla original como valor por defecto y botón de restaurar.
- Versiones para poder volver atrás.
- Protección con el PIN existente.

**Fuera (por ahora):**
- Las etiquetas del Preweigh (Preweigh, Missing, Refer): son hoja Letter y otro sistema. Se podrían migrar en una fase posterior.
- Fuentes internas de la impresora, scripts y conexión a bases de datos de Label View.
- Impresión directa con comandos DPL (la PC de impresión está administrada por IT y no se puede instalar nada).

### 1.4 Decisiones abiertas (responder antes de empezar)
1. **¿Qué cambios hacen hoy en Label View?** Si solo mueven o renombran campos, basta la Fase A (formulario). Si necesitan diseñar desde cero, hace falta la Fase B (editor visual).
2. **¿Quién puede editar?** Propuesta: solo con PIN. Ver quién conoce el PIN.
3. **¿Una plantilla o varias?** Una sola es lo más simple. Varias (por tipo de ingrediente, por cliente) agregan selector y administración.
4. **¿Un solo tamaño (4×2) o varios?** Varios tamaños implican página de impresión dinámica y calibración por plantilla.
5. **¿Código de barras?** Si sí, ¿qué tipo (Code 128 u otro) y qué dato codifica?
6. **¿Logo en la etiqueta?** Ya existe un logo compartido en la app; se podría reutilizar.

### 1.5 Modelo de datos

Plantilla (guardada como JSON):

```json
{
  "id": "ingredient-4x2",
  "name": "Ingredient label",
  "version": 3,
  "width": 1000,
  "height": 500,
  "unit": "svg-units-250-per-inch",
  "elements": [
    { "id": "e1", "type": "field", "field": "nameWithBatch", "x": 48, "y": 46,
      "size": 44, "bold": true, "maxW": 905, "minSize": 16 },
    { "id": "e2", "type": "text",  "text": "Item Code :", "x": 48, "y": 98, "size": 36 },
    { "id": "e3", "type": "line",  "x1": 240, "x2": 511, "y": 98, "thickness": 2.5 },
    { "id": "e4", "type": "field", "field": "part", "x": 250, "y": 94, "size": 36, "bold": true, "maxW": 255 }
  ]
}
```

Tipos de elemento:
- `text`: texto fijo (posición, tamaño, negrita, alineación).
- `field`: campo variable que se rellena solo. Lista cerrada: `name`, `batch`, `nameWithBatch`, `seq`, `part`, `desc`, `container`, `of`, `date`.
- `line`: línea horizontal o vertical con grosor.
- `rect`: rectángulo con o sin relleno (opcional).
- `image`: logo compartido (opcional).
- `barcode`: código de barras (opcional, Fase C).

Reglas de cada elemento de tipo `field`: ancho máximo, tamaño base, tamaño mínimo legible. De ahí sale la validación de texto largo (hoy fija en `checkLabel`).

### 1.6 Almacenamiento y API
- Nuevo hash en Redis, por ejemplo `lm:tpl` (una entrada por plantilla) y `lm:tpl:hist` (versiones anteriores, máximo 20 por plantilla).
- Nueva ruta `templates` en `api/[route].js`:
  - `GET /api/templates` → lista (id, nombre, versión).
  - `GET /api/templates?id=X` → plantilla completa.
  - `POST` con `op: 'save' | 'restore' | 'delete'` y la plantilla; todo cambio exige el PIN.
- Validación en el **servidor** (los límites del navegador no bastan): máximo de elementos (por ejemplo 80), rangos de coordenadas dentro del lienzo, tamaños de letra razonables, campos solo de la lista cerrada, largo de textos fijos.
- Si no hay plantilla guardada, el cliente usa la **plantilla original incorporada** en el código (copia exacta del diseño actual). Así nada se rompe si la base falla o está vacía.

### 1.7 Cambios en el código
1. **Renderizador de plantillas** (`src/TemplateLabel.jsx`): recibe plantilla + datos y dibuja el SVG. Reutiliza `fit`/`measure`/`T`/`Line` de `IngredientLabel.jsx`.
2. **Plantilla original** (`src/defaultTemplate.js`): el diseño actual expresado como datos.
3. **`rasterize.js`**: sin cambios de fondo. Solo recibe el renderizador nuevo en vez del componente fijo.
4. **Validación**: `checkLabel` pasa a calcularse a partir de los elementos `field` de la plantilla (ancho máximo y tamaño mínimo de cada uno).
5. **`IngredientLabels.jsx`**: carga la plantilla activa, la usa en vista previa e impresión.
6. **Editor** (`src/LabelEditor.jsx`): ver fases.
7. **`api.js` y `i18n.js`**: funciones de cliente y textos ES/EN.

### 1.8 Plan por fases

**Fase 0 — Preparación (pequeña)**
- Extraer el diseño actual a `defaultTemplate.js` como datos.
- Hacer que `TemplateLabel` dibuje esa plantilla y comparar píxel a píxel con la etiqueta actual (prueba automática con el navegador de pruebas). **Criterio:** el bitmap resultante es idéntico al de hoy.

**Fase A — Editor por formulario (lo recomendado para empezar)**
- Ruta `templates` en el servidor con PIN, validación y versiones.
- Pantalla «Editar etiqueta» con:
  - Vista previa grande en vivo, con datos de ejemplo editables.
  - Lista de elementos; al elegir uno, panel de propiedades (X, Y, tamaño, negrita, ancho máximo, alineación, texto o campo).
  - Agregar, duplicar, borrar y reordenar elementos.
  - Flechas para mover 1 punto o 10 puntos.
  - Campos de ancho/alto de la etiqueta fijos en 4×2.
- Guardar para todos, historial de versiones, restaurar versión anterior y restaurar original.
- Aviso de cambios sin guardar y de elementos fuera del lienzo.
- **Criterio:** una persona sin conocimientos técnicos mueve un campo, cambia el tamaño de un texto y agrega una línea, guarda, y otra PC imprime la etiqueta nueva.

**Fase B — Editor visual (solo si hace falta)**
- Arrastrar y soltar elementos sobre la vista previa; redimensionar con manijas.
- Cuadrícula e imán (snap) a 5 y 10 puntos; guías de alineación.
- Selección múltiple y alinear/distribuir.
- Deshacer y rehacer (pila de cambios), teclas de atajo.
- Zoom y regla en pulgadas.
- **Criterio:** diseñar una etiqueta nueva de cero en menos de 10 minutos.

**Fase C — Extras (opcionales, cada uno independiente)**
- Código de barras Code 128 (librería ligera, se dibuja directo al bitmap).
- Logo compartido como elemento.
- Varias plantillas y selector.
- Varios tamaños de etiqueta (página de impresión y calibración por plantilla).
- Migrar los tags del Preweigh al mismo sistema de plantillas.

### 1.9 Estimación de esfuerzo
| Fase | Esfuerzo aproximado |
|------|--------------------|
| 0 | Pequeño |
| A | Medio (una sesión de trabajo seria) |
| B | Alto (varias sesiones; es lo que más errores de uso produce) |
| C | Pequeño a medio, cada extra por separado |

### 1.10 Riesgos y cómo se mitigan
- **Alguien rompe la etiqueta de todos.** PIN obligatorio, versiones y botón «restaurar original».
- **Texto ilegible por una plantilla mal hecha.** La validación de largo corre con las reglas de cada campo; si no cabe, avisa y pide confirmación antes de imprimir.
- **La impresión cambia de aspecto.** La salida sigue siendo el mismo bitmap 1:1 a 203 dpi; se verifica con la prueba de píxeles de la Fase 0 y con la etiqueta de prueba de puntos (1:1).
- **Fuentes.** Solo hay fuentes del sistema (Arial y similares); distintas PCs pueden medir texto un poco distinto. Se mantiene Arial como fuente única y se deja margen en los anchos máximos.
- **Dos personas editan a la vez.** Se guarda el número de versión; si el servidor tiene una más nueva, avisa y deja elegir en vez de pisar.
- **Servidor sin base de datos.** Se usa la plantilla original incorporada.
- **Calibración.** El desplazamiento en mm y el grosor siguen siendo ajustes de cada PC (`localStorage`); no forman parte de la plantilla.

### 1.11 Pruebas
- Comparación automática del bitmap de la plantilla original contra la etiqueta actual (Fase 0).
- Prueba del servidor: rechazo de coordenadas fuera de rango, campos desconocidos, demasiados elementos y PIN incorrecto.
- Prueba del editor: agregar, mover, borrar, guardar, restaurar versión.
- Prueba de impresión en la Datamax real (etiqueta de prueba 1:1 y etiqueta de ingrediente) antes de dar la fase por cerrada.

### 1.12 Criterios para dar el pendiente por terminado
- Cualquier cambio de diseño se hace desde la app, sin tocar código.
- Lo guardado lo ven todas las PCs al recargar.
- La etiqueta impresa con la plantilla original queda igual a la de hoy.
- Hay forma de volver atrás.
- Textos demasiado largos siguen avisando antes de imprimir.

---

## 2. Registrar en el historial las impresiones de ingredientes
Hoy el historial (`/api/history`) solo registra las impresiones de los tags del Preweigh. Las etiquetas de ingredientes no se registran.

Plan: guardar fórmula, rango de batches, cantidad de etiquetas, usuario (`lm.by`) y fecha; mostrarlo en el historial con un filtro «Ingredientes». Requiere ampliar `cleanHistory` en el servidor y `HistoryModal.jsx`.

## 3. Subir a `main` los cambios pendientes
Al retomar el trabajo, comprobar con `git log origin/main..HEAD` si la rama `claude/tender-euler-9k1dp7` tiene commits que `main` no tiene, y subirlos solo con confirmación.
