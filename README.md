# Label Master – Preweigh tags

Creado por **Roberto Gauna** · Created by Roberto Gauna

App para generar e imprimir los tags de preweigh (Preweigh, Missing y Keep in Refer).
React + Vite + Tailwind. Las fórmulas y el logo son **compartidos**: se guardan en
Upstash Redis mediante una función de Vercel (`api/[route].js`).

## Etiquetas de ingredientes (4 × 2 in)
Botón **Etiquetas de ingredientes** en la barra de la app. Escribes la fórmula y se imprimen sus etiquetas
(Seq # 10, 20, 30…, Item Code, Description, Container 1 OF 1…). La lista de ingredientes de cada fórmula se arma
una sola vez (a mano, pegando desde Excel o con el catálogo de números de parte en CSV `Part,Description`) y queda
guardada para todos. Los ingredientes nuevos entran solos al catálogo.

Impresión desde el navegador con el driver de la Datamax (203 dpi): en el diálogo elegir papel **4 × 2 in**, escala
**100%** y sin márgenes. Si sale corrido, se ajusta en *Alineación de la impresora* (hay una etiqueta de prueba).

## Publicar en Vercel
1. Importa el repo en Vercel (Framework: Vite). Pulsa **Deploy**.
2. **Base de datos:** en el proyecto → pestaña **Storage** → **Create Database** (o Marketplace) → **Upstash Redis** →
   crea la base y **Connect Project**. Esto agrega solas las variables `KV_REST_API_URL` y `KV_REST_API_TOKEN`.
3. **PIN (opcional):** proyecto → **Settings → Environment Variables** → agrega `EDIT_PIN` con el PIN que quieras
   (Environments: Production). Guarda.
4. **Redeploy:** pestaña **Deployments** → los tres puntos del último despliegue → **Redeploy**
   (las variables nuevas solo se aplican en despliegues nuevos).

Con PIN: cualquiera puede **agregar** fórmulas nuevas, pero **editar, borrar, importar o cambiar el logo** pide el PIN
(se pregunta una vez por navegador). Sin PIN: cualquiera con el enlace puede editar todo.

## Desarrollo local
```
npm install
npm run dev          # solo interfaz (sin servidor compartido)
npx vercel dev       # interfaz + API (requiere vercel CLI y la base conectada)
```
