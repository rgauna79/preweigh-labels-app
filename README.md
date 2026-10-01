# Label Master – Preweigh tags

Creado por **Roberto Gauna** · Created by Roberto Gauna

App para generar e imprimir los tags de preweigh (Preweigh, Missing y Keep in Refer).
React + Vite + Tailwind. Las fórmulas y el logo son **compartidos**: se guardan en
Upstash Redis mediante una función de Vercel (`api/[route].js`).

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
