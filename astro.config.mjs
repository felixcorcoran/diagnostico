// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import vercel from '@astrojs/vercel';

/** @param {number} weight */
const sora = (weight) => `@fontsource/sora/files/sora-latin-${weight}-normal.woff2`;

export default defineConfig({
  site: 'https://diagnostico.felixcorcoran.es',
  // La página es estática; solo /api/diagnostico se ejecuta en el servidor
  output: 'static',
  adapter: vercel({
    // Peor caso medido en el código: https que no responde (8 s) + http
    // (8 s) + enlaces de reserva (6 s). Con margen.
    maxDuration: 30,
  }),
  fonts: [
    {
      // La misma Sora que felixcorcoran.es, self-hosted y solo latin
      provider: fontProviders.local(),
      name: 'Sora',
      cssVariable: '--font-sora',
      fallbacks: ['sans-serif'],
      options: {
        variants: [
          { weight: 300, style: 'normal', src: [sora(300)] },
          { weight: 400, style: 'normal', src: [sora(400)] },
          { weight: 500, style: 'normal', src: [sora(500)] },
          { weight: 600, style: 'normal', src: [sora(600)] },
        ],
      },
    },
  ],
  build: {
    inlineStylesheets: 'always',
  },
});
