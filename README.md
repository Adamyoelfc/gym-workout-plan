# Adam Shred React SPA

Esta versión es React + Vite. Mejor que el `index.html` plano porque:
- no se queda en blanco si falla un GIF,
- abre GIFs grandes con `object-fit: contain`,
- cachea ExerciseDB en localStorage,
- tiene Refresh GIF real,
- abre YouTube Shorts en vez de videos largos.

## Local

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Cloudflare Pages

Opción fácil:
1. Sube este folder a GitHub.
2. Cloudflare Pages → Create project → Connect GitHub.
3. Build command: `npm run build`
4. Build output directory: `dist`
5. Deploy.

Opción manual:
1. Corre `npm install && npm run build`
2. Cloudflare Pages → Upload assets
3. Sube el contenido de la carpeta `dist/`, no el folder completo.
# gym-workout-plan
