# diagnostico

Herramienta pública (diagnostico.felixcorcoran.es): dada una URL, dice qué se encuentra un cliente
al entrar. Astro 7 con funciones de servidor en Vercel (París), TypeScript, ES/EN, tema claro/oscuro.
Más detalle en `README.md`.

## Mapa

- `src/lib/inspect.ts`: las comprobaciones de la portada (cheerio).
- `src/lib/http.ts`: peticiones solo a direcciones públicas (protección SSRF).
- `src/lib/limit.ts`: límite por IP y caché de 10 min en memoria.
- `src/data/senales.ts`: texto de cada señal (es/en). Una señal que no esté aquí no se muestra.
- `src/data/textos.ts`, `src/data/site.ts`: resto de textos y datos del sitio.
- `src/pages/api/diagnostico.ts` (POST `{ url }`) y `velocidad.ts` (PageSpeed).
- `src/views/Diagnostico.astro`: la página; `src/pages/index.astro` y `en/` la montan.
- `tests/`: Vitest (`http`, `inspect`, `limit`).

## Reglas

- Cada frase de un resultado tiene que responder a «¿cómo sé esto?». Nada que no se pueda comprobar
  desde fuera.
- **Seguridad:** toda petición saliente pasa por `src/lib/http.ts`. No usar `fetch` directo ni
  saltarse la comprobación DNS en redirecciones. Cualquier cambio ahí va con pruebas en
  `tests/http.test.ts`.
- La URL que escribe el usuario no se guarda ni se loguea.
- Señal nueva = comprobación en `inspect.ts` + textos es/en en `senales.ts` + prueba.

## Comandos

- `npx astro dev --background` (dev), `npm test`, `npm run check`, `npm run build`.
- Antes de dar algo por terminado: `npm test && npm run check && npm run build` (lo mismo que CI).
- `PAGESPEED_API_KEY` en `.env.local` es opcional. No leer ni mostrar `.env.local`.
- Despliegue: Vercel al hacer push a `main`.

No leer: `node_modules/`, `dist/`, `.astro/`, `.vercel/output/`.
