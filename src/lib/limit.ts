/**
 * Límite por IP y caché de 10 minutos, en la memoria de cada instancia de
 * Vercel. Es un freno, no un muro: corta a quien repite desde el mismo
 * navegador, no a un ataque repartido. Si hiciera falta más, regla de rate
 * limit en el Firewall de Vercel o Upstash.
 */

const WINDOW_MS = 10 * 60_000;

export function limiter(maxPerWindow: number) {
	const hits = new Map<string, number[]>();
	return (ip: string): boolean => {
		const now = Date.now();
		const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
		if (recent.length >= maxPerWindow) {
			hits.set(ip, recent);
			return true;
		}
		recent.push(now);
		hits.set(ip, recent);
		if (hits.size > 5_000) for (const [key, times] of hits) if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(key);
		return false;
	};
}

export function memo<T>() {
	const cache = new Map<string, { at: number; value: T }>();
	return {
		get: (key: string) => {
			const hit = cache.get(key);
			return hit && Date.now() - hit.at < WINDOW_MS ? hit.value : undefined;
		},
		set: (key: string, value: T) => {
			if (cache.size > 2_000) cache.clear();
			cache.set(key, { at: Date.now(), value });
		},
	};
}

export const clientIp = (request: Request, clientAddress: string | undefined) =>
	request.headers.get('x-forwarded-for')?.split(',')[0].trim() || clientAddress || 'desconocida';

/** La misma web con o sin www, http o barra final cuenta como una */
export const siteKey = (url: URL) => url.href.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').toLowerCase();
