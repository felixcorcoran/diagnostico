/**
 * POST /api/diagnostico  { url: string, lang?: 'es' | 'en' }
 *
 * Devuelve los hechos comprobados de la portada, ya con sus textos en el
 * idioma pedido. La dirección no se guarda ni se escribe en los logs.
 */

import type { APIRoute } from 'astro';
import { inspect, normalizeInput, InputError, type Inspection } from '../../lib/inspect.ts';
import { describe, errores, noComprobado, type Lang } from '../../data/senales.ts';

export const prerender = false;

/**
 * Límite por IP. Vive en la memoria de cada instancia de Vercel, así que es un
 * freno, no un muro: corta a quien repite desde el mismo navegador, no a un
 * ataque repartido. Si hiciera falta más, regla de rate limit en el Firewall
 * de Vercel o Upstash.
 */
const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 8;
const hits = new Map<string, number[]>();

function limited(ip: string): boolean {
	const now = Date.now();
	const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
	if (recent.length >= MAX_PER_WINDOW) {
		hits.set(ip, recent);
		return true;
	}
	recent.push(now);
	hits.set(ip, recent);
	if (hits.size > 5_000) for (const [key, times] of hits) if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(key);
	return false;
}

/**
 * La misma web pedida dos veces seguidas no se vuelve a visitar. Se guarda la
 * comprobación, no la respuesta: así sirve para los dos idiomas.
 */
const CACHE_MS = 10 * 60_000;
const cache = new Map<string, { at: number; result: Inspection }>();

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

	const key = url.href.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').toLowerCase();
	const hit = cache.get(key);
	if (hit && Date.now() - hit.at < CACHE_MS) return respond(hit.result, lang);

	const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || clientAddress || 'desconocida';
	if (limited(ip)) return json(429, { error: errores[lang].rate }, { 'retry-after': '600' });

	try {
		const result = await inspect(url);
		// «No se ha podido comprobar» no se guarda: volver a probar tiene que volver a mirar
		if (result.outcome !== 'unverified') cache.set(key, { at: Date.now(), result });
		return respond(result, lang);
	} catch (err) {
		if (err instanceof InputError) return json(400, { error: errores[lang][err.code] });
		console.error('diagnostico: fallo inesperado', (err as Error).name, (err as Error).message);
		return json(500, { error: errores[lang].server });
	}
};
