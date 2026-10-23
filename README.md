# Diagnóstico — diagnostico.felixcorcoran.es

Herramienta pública: alguien escribe la dirección de su web y ve qué se encuentra un cliente al
entrar. Solo hechos comprobables de la portada; al final, la invitación a la auditoría de
felixcorcoran.es.

- `src/lib/inspect.ts` — las comprobaciones. Viene de `src/lib/website.ts` del radar comercial.
- `src/lib/http.ts` — peticiones solo a direcciones públicas (cada redirección y cada conexión se
  comprueban), tiempos cortos y sin mirar robots.txt (es una visita que pide una persona).
- `src/data/senales.ts` — qué se enseña de cada señal y por qué importa. Una señal que no esté
  aquí no se enseña. Mismas reglas de copy que la landing: nada que no responda a «¿cómo sé esto?».
- `src/pages/api/diagnostico.ts` — el endpoint (`POST { url }`), con límite por IP y caché de 10
  minutos en memoria. La dirección no se guarda ni se escribe en los logs.

## Desarrollo

```
npm install
npx astro dev --background --port 4330
npx astro check
```

## Fuera del MVP (por decidir)

- Ficha de Google (reseñas, horario): Places cuesta por consulta; necesita un límite de gasto.
- Velocidad en móvil con PageSpeed Insights (gratis, pero añade espera).
- Enviar el informe por correo.
- Límite por IP más fuerte (regla de rate limit en el Firewall de Vercel o Upstash).
