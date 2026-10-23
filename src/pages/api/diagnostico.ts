/**
 * POST /api/diagnostico  { url: string }
 *
 * Devuelve los hechos comprobados de la portada, ya con su explicación. La
 * dirección no se guarda ni se escribe en los logs.
 */

import type { APIRoute } from 'astro';
import { inspect, normalizeInput, InputError } from '../../lib/inspect.ts';
import { senales, noComprobado, type Nivel } from '../../data/senales.ts';

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

/** La misma web pedida dos veces seguidas no se vuelve a visitar */
const CACHE_MS = 10 * 60_000;
const cache = new Map<string, { at: number; body: string }>();

const ORDER: Record<Nivel, number> = { fallo: 0, aviso: 1, neutro: 2, bien: 3 };

const json = (status: number, data: unknown, headers: Record<string, string> = {}) =>
	new Response(typeof data === 'string' ? data : JSON.stringify(data), {
		status,
		headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
	});

export const POST: APIRoute = async ({ request, clientAddress }) => {
	let raw: unknown;
	try {
		raw = ((await request.json()) as { url?: unknown }).url;
	} catch {
		return json(400, { error: 'Escribe la dirección de una web.' });
	}
	if (typeof raw !== 'string') return json(400, { error: 'Escribe la dirección de una web.' });

	let url: URL;
	try {
		url = normalizeInput(raw);
	} catch (err) {
		if (err instanceof InputError) return json(400, { error: err.message });
		throw err;
	}

	const key = url.href.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').toLowerCase();
	const hit = cache.get(key);
	if (hit && Date.now() - hit.at < CACHE_MS) return json(200, hit.body);

	const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || clientAddress || 'desconocida';
	if (limited(ip)) {
		return json(429, { error: 'Has hecho varias comprobaciones seguidas. Espera unos minutos y vuelve a probar.' }, { 'retry-after': '600' });
	}

	try {
		const result = await inspect(url);
		const hallazgos = result.evidence
			.filter((e) => e.signal in senales)
			.map((e) => ({ senal: e.signal, ...senales[e.signal], hecho: e.fact, detalle: e.detail ?? null }))
			.sort((a, b) => ORDER[a.nivel] - ORDER[b.nivel]);
		const body = JSON.stringify({
			url: result.url,
			finalUrl: result.finalUrl,
			titulo: result.title,
			comprobadoEl: result.checkedAt,
			estado: result.outcome,
			hallazgos,
			noComprobado,
		});
		// «No se ha podido comprobar» no se guarda: volver a probar tiene que volver a mirar
		if (result.outcome !== 'unverified') cache.set(key, { at: Date.now(), body });
		return json(200, body);
	} catch (err) {
		if (err instanceof InputError) return json(400, { error: err.message });
		console.error('diagnostico: fallo inesperado', (err as Error).name, (err as Error).message);
		return json(500, { error: 'Algo ha fallado al hacer la comprobación. Vuelve a probar en un momento.' });
	}
};
