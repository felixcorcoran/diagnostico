/**
 * Peticiones a la web que escribe el visitante. Viene de la del radar
 * comercial, con dos cambios porque aquí la dirección la escribe cualquiera:
 *
 * 1. Solo se llega a direcciones públicas. Cada conexión comprueba la IP a la
 *    que resuelve el dominio (también tras cada redirección), así que nadie
 *    puede usar la herramienta para asomarse a una red interna (SSRF).
 * 2. Tiempos cortos: el resultado tiene que salir mientras la persona espera.
 *
 * No se mira robots.txt: no es un rastreador, es una visita que pide una
 * persona, como cuando se pega un enlace en WhatsApp y se genera la vista previa.
 */

import { BlockList, isIP } from 'node:net';
import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import { Agent, fetch } from 'undici';

export const USER_AGENT = 'Mozilla/5.0 (compatible; DiagnosticoFC/0.1; +https://diagnostico.felixcorcoran.es)';

export type FetchFailure = 'dns' | 'timeout' | 'tls' | 'network';

export interface FetchResult {
	ok: true;
	status: number;
	finalUrl: string;
	contentType: string;
	body: string;
}

export interface FetchError {
	ok: false;
	failure: FetchFailure | 'blocked-address';
	detail: string;
}

const MAX_BODY = 2_000_000;
const MAX_REDIRECTS = 5;

/** Rangos que no son internet público (RFC 6890 y compañía) */
const PRIVATE = new BlockList();
for (const [net, prefix] of [
	['0.0.0.0', 8],
	['10.0.0.0', 8],
	['100.64.0.0', 10],
	['127.0.0.0', 8],
	['169.254.0.0', 16],
	['172.16.0.0', 12],
	['192.0.0.0', 24],
	['192.0.2.0', 24],
	['192.168.0.0', 16],
	['198.18.0.0', 15],
	['198.51.100.0', 24],
	['203.0.113.0', 24],
	['224.0.0.0', 4],
	['240.0.0.0', 4],
] as const) {
	PRIVATE.addSubnet(net, prefix, 'ipv4');
}
for (const [net, prefix] of [
	['::', 128],
	['::1', 128],
	['64:ff9b::', 96],
	['100::', 64],
	['2001:db8::', 32],
	['fc00::', 7],
	['fe80::', 10],
	['ff00::', 8],
] as const) {
	PRIVATE.addSubnet(net, prefix, 'ipv6');
}

export function isPublicAddress(address: string): boolean {
	const family = isIP(address);
	if (family === 4) return !PRIVATE.check(address, 'ipv4');
	if (family === 6) {
		// ::ffff:10.0.0.1 es una IPv4 disfrazada: se mira como IPv4
		const mapped = address.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
		if (mapped) return isPublicAddress(mapped[1]);
		return !PRIVATE.check(address, 'ipv6');
	}
	return false;
}

class BlockedAddressError extends Error {
	code = 'EBLOCKEDADDRESS';
}

/**
 * Resolución de nombres para cada conexión: si alguna IP no es pública, no se
 * conecta. Va dentro de la conexión (no antes) para que un DNS que cambia de
 * respuesta entre la comprobación y la conexión no sirva de atajo.
 */
function safeLookup(
	hostname: string,
	options: { all?: boolean; family?: number },
	callback: (err: Error | null, address: string | LookupAddress[], family?: number) => void,
) {
	dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
		if (err) return callback(err, []);
		const list = addresses as LookupAddress[];
		if (list.length === 0 || list.some((a) => !isPublicAddress(a.address))) {
			return callback(new BlockedAddressError(`${hostname} no resuelve a una dirección pública`), []);
		}
		if (options.all) callback(null, list);
		else callback(null, list[0].address, list[0].family);
	});
}

const agent = new Agent({ connect: { lookup: safeLookup as never }, headersTimeout: 8_000, bodyTimeout: 8_000 });

/** ¿Se puede pedir esta dirección? http(s), puertos estándar y sin IPs privadas a pelo */
export function isAllowedUrl(url: URL): boolean {
	if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
	if (url.port && url.port !== '80' && url.port !== '443') return false;
	if (url.username || url.password) return false;
	const host = url.hostname.replace(/^\[|\]$/g, '');
	// Una IP escrita tal cual no pasa por la resolución de nombres: se mira aquí
	if (isIP(host)) return isPublicAddress(host);
	return host.includes('.') && !host.endsWith('.local') && !host.endsWith('.internal');
}

export async function fetchPage(url: string, timeoutMs = 8_000): Promise<FetchResult | FetchError> {
	const signal = AbortSignal.timeout(timeoutMs);
	let current = url;
	try {
		// Las redirecciones se siguen a mano para comprobar cada destino
		for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
			if (!isAllowedUrl(new URL(current))) {
				return { ok: false, failure: 'blocked-address', detail: 'La dirección no es una web pública' };
			}
			const res = await fetch(current, {
				redirect: 'manual',
				signal,
				dispatcher: agent,
				headers: {
					'user-agent': USER_AGENT,
					accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
					'accept-language': 'es-ES,es;q=0.9,en;q=0.5',
				},
			});
			const location = res.headers.get('location');
			if (res.status >= 300 && res.status < 400 && location) {
				await res.body?.cancel();
				current = new URL(location, current).href;
				continue;
			}
			const contentType = res.headers.get('content-type') ?? '';
			const body = contentType.includes('html') || contentType.includes('text') ? (await res.text()).slice(0, MAX_BODY) : '';
			if (!body) await res.body?.cancel().catch(() => {});
			return { ok: true, status: res.status, finalUrl: current, contentType, body };
		}
		return { ok: false, failure: 'network', detail: 'Demasiadas redirecciones' };
	} catch (err) {
		return { ok: false, ...classifyError(err) };
	}
}

function classifyError(err: unknown): { failure: FetchError['failure']; detail: string } {
	const e = err as { name?: string; message?: string; code?: string; cause?: { code?: string; message?: string } };
	const code = e.cause?.code ?? e.code ?? '';
	if (code === 'EBLOCKEDADDRESS') return { failure: 'blocked-address', detail: 'La dirección no es una web pública' };
	if (e.name === 'TimeoutError' || e.name === 'AbortError' || code.startsWith('UND_ERR_') && code.includes('TIMEOUT')) {
		return { failure: 'timeout', detail: 'Sin respuesta en el tiempo límite' };
	}
	if (code === 'ENOTFOUND') return { failure: 'dns', detail: 'ENOTFOUND: el dominio no existe' };
	if (code === 'ESERVFAIL' || code === 'EAI_AGAIN') return { failure: 'dns', detail: `${code}: el dominio no resuelve` };
	if (code.startsWith('CERT_') || code.includes('SSL') || code.includes('TLS') || code.includes('SELF_SIGNED') || code === 'ERR_TLS_CERT_ALTNAME_INVALID') {
		return { failure: 'tls', detail: `Certificado: ${code}` };
	}
	return { failure: 'network', detail: code || e.cause?.message || e.message || 'Error de red' };
}
