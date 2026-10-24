# Diagnóstico web

Herramienta pública: escribes la dirección de una web y te dice qué se encuentra un cliente al entrar, solo con hechos que el código puede comprobar. Español e inglés, modo claro y oscuro.

**En marcha:** [diagnostico.felixcorcoran.es](https://diagnostico.felixcorcoran.es) · [English](https://diagnostico.felixcorcoran.es/en)

![Diagnóstico web](public/og.png)

## Qué comprueba

Visita la portada como lo haría una persona y revisa, entre otras cosas:

- si la web responde, si redirige a otro dominio y si el certificado HTTPS es válido;
- si el teléfono se puede pulsar en el móvil y si hay forma de contactar desde la portada;
- si la página está preparada para el móvil y si los enlaces internos funcionan;
- título, descripción y vista previa al compartir (incluida la imagen);
- un año de copyright antiguo o un enlace de reservas roto;
- la velocidad en móvil con PageSpeed Insights, si hay clave de API.

Cada resultado dice el hecho que ha encontrado y por qué importa. Lo que no se puede saber desde fuera no se dice: la regla es que cada frase responda a «¿cómo sé esto?».

## Cómo está hecho

- **Astro 6** con funciones en servidor en **Vercel** (región de París) y **TypeScript**.
- **Peticiones seguras** (`src/lib/http.ts`): solo a direcciones públicas. La resolución DNS se comprueba en cada conexión y en cada redirección, para que nadie pueda usar la herramienta contra redes internas (SSRF). Tiempos cortos y un agente identificado.
- **Límites** (`src/lib/limit.ts`): un máximo de peticiones por IP y caché de 10 minutos en memoria. La dirección que se escribe no se guarda ni sale en los logs.
- **Señales** (`src/data/senales.ts`): qué se enseña de cada comprobación, en los dos idiomas. Una señal que no esté ahí no se muestra.

```
src/lib/inspect.ts            las comprobaciones de la portada
src/lib/http.ts               peticiones solo a direcciones públicas
src/lib/limit.ts              límite por IP y caché
src/data/senales.ts           textos de cada señal (es / en)
src/pages/api/                diagnostico.ts (POST { url }) y velocidad.ts
src/views/Diagnostico.astro   la página
```

## En local

```sh
npm install
npx astro dev
npx astro check
```

Para la velocidad en móvil, añade `PAGESPEED_API_KEY` en `.env.local` (gratis en Google Cloud). Sin ella, el resto funciona igual.

---

Hecho por [Félix Corcoran](https://dev.felixcorcoran.es) para [felixcorcoran.es](https://felixcorcoran.es).
