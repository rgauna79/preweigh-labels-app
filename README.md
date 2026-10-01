# Label Master – Preweigh tags

App para generar e imprimir los tags de preweigh (Preweigh, Missing y Keep in Refer).
React + Vite + Tailwind. Las fórmulas y el logo son **compartidos**: se guardan en
Netlify Blobs mediante una función (`netlify/functions/api.mjs`).

## Publicar en Netlify
1. Netlify → **Add new site → Import an existing project** → elige este repo.
2. Los valores salen de `netlify.toml` (build `npm run build`, carpeta `dist`). Pulsa **Deploy**.
3. *(Opcional)* PIN de edición: **Site configuration → Environment variables →** `EDIT_PIN` = el PIN que quieras, y vuelve a desplegar.
   - Con PIN: cualquiera puede **agregar** fórmulas nuevas, pero **editar, borrar, importar o cambiar el logo** pide el PIN (se pregunta una vez por navegador).
   - Sin PIN: cualquiera con el enlace puede editar todo.

## Desarrollo local
```
npm install
npm run dev          # solo interfaz (sin servidor compartido)
npx netlify dev      # interfaz + API (requiere netlify-cli)
```
