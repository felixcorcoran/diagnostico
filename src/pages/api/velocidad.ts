/**
 * POST /api/velocidad  { url: string, lang?: 'es' | 'en' }
 *
 * La velocidad en móvil, según PageSpeed Insights de Google. Va aparte del
 * diagnóstico porque tarda 10–30 s: la página enseña primero lo demás y esto
 * llega después.
 *
 * Necesita PAGESPEED_API_KEY (una clave de Google Cloud con la API de
 * PageSpeed Insights activada; sin clave, Google corta por cuota). Sin ella
 * responde { disponible: false } y la página no enseña la fila.
 */

import type { APIRoute } from 'astro';
import { normalizeInput, InputError, type Evidence } from '../../lib/inspect.ts';
import { clientIp, limiter, memo, siteKey } from '../../lib/limit.ts';
import { describe, type Lang } from '../../data/senales.ts';

export const prerender = false;

const limited = limiter(8);
const cache = memo<{ score: number; lcpMs: number }>();
const ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

const json = (status: number, data: unknown) =>
	new Response(JSON.stringify(data), {
		status,
		headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
	});

async function measure(url: string, key: string) {
	const query = new URLSearchParams({ url, strategy: 'mobile', category: 'performance', key });
	const res = await fetch(`${ENDPOINT}?${query}`, { signal: AbortSignal.timeout(50_000) });
	if (!res.ok) throw new Error(`PageSpeed HTTP ${res.status}`);
	const data = (await res.json()) as {
		lighthouseResult?: { categories?: { performance?: { score?: number | null } }; audits?: Record<string, { numericValue?: number }> };
	};
	const score = data.lighthouseResult?.categories?.performance?.score;
	const lcpMs = data.lighthouseResult?.audits?.['largest-contentful-paint']?.numericValue;
	if (typeof score !== 'number' || typeof lcpMs !== 'number') throw new Error('PageSpeed sin datos');
	return { score: Math.round(score * 100), lcpMs };
}

function evidence({ score, lcpMs }: { score: number; lcpMs: number }, lang: Lang): Evidence {
	// Los mismos cortes que PageSpeed: rojo por debajo de 50, verde desde 90
	const signal = score < 50 ? 'velocidad_lenta' : score < 90 ? 'velocidad_mejorable' : 'velocidad_ok';
	const lcp = `${(lcpMs / 1000).toLocaleString(lang === 'en' ? 'en-GB' : 'es-ES', { maximumFractionDigits: 1 })} s`;
	return { signal, vars: { score: String(score), lcp } };
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
	const key = process.env.PAGESPEED_API_KEY;
	if (!key) return json(200, { disponible: false });

	let body: { url?: unknown; lang?: unknown };
	try {
		body = await request.json();
	} catch {
		body = {};
	}
	const lang: Lang = body.lang === 'en' ? 'en' : 'es';
	let url: URL;
	try {
		if (typeof body.url !== 'string') throw new InputError('empty');
		url = normalizeInput(body.url);
	} catch {
		return json(400, { disponible: false });
	}

	const cacheKey = siteKey(url);
	let result = cache.get(cacheKey);
	if (!result) {
		if (limited(clientIp(request, clientAddress))) return json(429, { disponible: false });
		try {
			result = await measure(url.href, key);
			cache.set(cacheKey, result);
		} catch (err) {
			console.error('velocidad: PageSpeed no ha respondido', (err as Error).message);
			return json(200, { disponible: false });
		}
	}
	return json(200, { disponible: true, hallazgos: describe([evidence(result, lang)], lang) });
};
