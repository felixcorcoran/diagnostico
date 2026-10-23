/**
 * POST /api/diagnostico  { url: string, lang?: 'es' | 'en' }
 *
 * Devuelve los hechos comprobados de la portada (y de las páginas que enlaza),
 * ya con sus textos en el idioma pedido. La dirección no se guarda ni se
 * escribe en los logs.
 */

import type { APIRoute } from 'astro';
import { inspect, normalizeInput, InputError, type Inspection } from '../../lib/inspect.ts';
import { clientIp, limiter, memo, siteKey } from '../../lib/limit.ts';
import { describe, errores, noComprobado, type Lang } from '../../data/senales.ts';

export const prerender = false;

const limited = limiter(8);
// Se guarda la comprobación, no la respuesta: así sirve para los dos idiomas
const cache = memo<Inspection>();

const json = (status: number, data: unknown, headers: Record<string, string> = {}) =>
	new Response(JSON.stringify(data), {
		status,
		headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
	});

function respond(result: Inspection, lang: Lang) {
	return json(200, {
		url: result.url,
		finalUrl: result.finalUrl,
		comprobadoEl: result.checkedAt,
		estado: result.outcome,
		hallazgos: describe(result.evidence, lang),
		noComprobado: noComprobado[lang],
		// La página solo enseña «Midiendo la velocidad…» si se va a poder medir
		velocidad: result.outcome === 'ok' && Boolean(process.env.PAGESPEED_API_KEY),
	});
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
	let body: { url?: unknown; lang?: unknown };
	try {
		body = await request.json();
	} catch {
		body = {};
	}
	const lang: Lang = body.lang === 'en' ? 'en' : 'es';
	if (typeof body.url !== 'string') return json(400, { error: errores[lang].empty });

	let url: URL;
	try {
		url = normalizeInput(body.url);
	} catch (err) {
		if (err instanceof InputError) return json(400, { error: errores[lang][err.code] });
		throw err;
	}

	const key = siteKey(url);
	const hit = cache.get(key);
	if (hit) return respond(hit, lang);

	if (limited(clientIp(request, clientAddress))) return json(429, { error: errores[lang].rate }, { 'retry-after': '600' });

	try {
		const result = await inspect(url);
		// «No se ha podido comprobar» no se guarda: volver a probar tiene que volver a mirar
		if (result.outcome !== 'unverified') cache.set(key, result);
		return respond(result, lang);
	} catch (err) {
		if (err instanceof InputError) return json(400, { error: errores[lang][err.code] });
		console.error('diagnostico: fallo inesperado', (err as Error).name, (err as Error).message);
		return json(500, { error: errores[lang].server });
	}
};
