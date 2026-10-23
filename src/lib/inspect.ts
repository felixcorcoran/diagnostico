/**
 * Comprobar la portada de una web: solo hechos comprobables, cada uno con su
 * fuente. Viene de src/lib/website.ts del radar comercial.
 *
 * Aquí no se interpreta nada: «el teléfono no tiene enlace tel:» es un hecho.
 * Por qué importa lo explica un texto fijo por señal (src/data/senales.ts).
 */

import * as cheerio from 'cheerio';
import { Resolver } from 'node:dns/promises';
import { fetchPage, isAllowedUrl, type FetchError, type FetchResult } from './http.ts';

export interface Evidence {
	/** Identificador estable de la señal (src/data/senales.ts) */
	signal: string;
	/** Los datos del hecho (teléfono, año, dominio…): el texto, en cada idioma, lo pone src/data/senales.ts */
	vars?: Record<string, string>;
	/** Cita literal o resultado técnico */
	detail?: string;
}

export interface PageSignals {
	title: string | null;
	hasViewport: boolean;
	telLinks: string[];
	/** Teléfonos que aparecen como texto en la página */
	phonesInText: string[];
	mailtoLinks: number;
	whatsapp: boolean;
	forms: number;
	/** Formularios que se pintan con JavaScript (no están en el HTML) */
	formPlugins: string[];
	bookingLinks: string[];
	/** Enlaces de reserva o cita (por plataforma o por el texto del botón), absolutos */
	bookingUrls: string[];
	copyrightYear: number | null;
	/** <meta name="description">: el texto que Google puede enseñar bajo el título */
	description: string | null;
	/** og:image, absoluta: la imagen de la vista previa al compartir el enlace */
	ogImage: string | null;
	/** Enlaces a otras páginas de la misma web, en orden (el menú suele ir primero) */
	internalLinks: { url: string; text: string }[];
}

export type Outcome =
	| 'ok' // la web carga y se ha leído
	| 'down' // no carga: el fallo es el hallazgo
	| 'unverified' // no se ha podido comprobar desde aquí; no se afirma nada
	| 'blocked'; // rechaza la visita automática

export interface Inspection {
	url: string;
	finalUrl: string | null;
	checkedAt: string;
	outcome: Outcome;
	title: string | null;
	evidence: Evidence[];
}

/** Lo que la persona ha escrito no es una web que se pueda comprobar. El mensaje, en cada idioma, en src/data/senales.ts */
export type InputErrorCode = 'empty' | 'invalid' | 'not_public' | 'social' | 'booking' | 'whatsapp';

export class InputError extends Error {
	code: InputErrorCode;
	constructor(code: InputErrorCode) {
		super(code);
		this.code = code;
	}
}

const SOCIAL = ['instagram.com', 'facebook.com', 'fb.com', 'fb.me', 'tiktok.com', 'linktr.ee', 'x.com', 'twitter.com', 'youtube.com'];
const BOOKING = [
	'treatwell.es',
	'treatwell.co.uk',
	'booksy.com',
	'fresha.com',
	'uala.es',
	'uala.it',
	'setmore.com',
	'calendly.com',
	'simplybook.me',
	'reservio.com',
	'bookitit.com',
	'timify.com',
	'doctoralia.es',
];
const WHATSAPP = ['wa.me', 'whatsapp.com', 'api.whatsapp.com'];
const FORM_PLUGINS: [string, RegExp][] = [
	['Ninja Forms', /ninja-forms|nf-form/i],
	['WPForms', /wpforms/i],
	['Contact Form 7', /wpcf7/i],
	['Gravity Forms', /gform_wrapper|gravityforms/i],
	['Elementor', /elementor-form/i],
	['Formidable', /frm_forms/i],
];

const matchesDomain = (host: string, list: string[]) => list.some((d) => host === d || host.endsWith('.' + d));

/**
 * De lo que escribe la persona («mipeluqueria.es», «www…», una URL entera) a
 * una URL. Sin protocolo se prueba primero https.
 */
export function normalizeInput(raw: string): URL {
	const text = raw.trim();
	if (!text || text.length > 300 || /\s/.test(text)) throw new InputError('empty');
	let url: URL;
	try {
		url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`);
	} catch {
		throw new InputError('invalid');
	}
	if (!isAllowedUrl(url)) throw new InputError('not_public');
	const host = url.hostname.toLowerCase().replace(/^www\./, '');
	if (matchesDomain(host, SOCIAL)) throw new InputError('social');
	if (matchesDomain(host, BOOKING)) throw new InputError('booking');
	if (matchesDomain(host, WHATSAPP)) throw new InputError('whatsapp');
	url.hash = '';
	return url;
}

/**
 * ¿Resuelve el dominio para cualquiera? Consulta a DNS públicos, no al del
 * servidor. nxdomain: no existe. servfail: existe pero sus DNS no responden,
 * así que a nadie le carga. ok: resuelve (o no se puede afirmar lo contrario).
 */
async function publicDns(url: string): Promise<'ok' | 'nxdomain' | 'servfail'> {
	const host = new URL(url).hostname;
	const resolver = new Resolver({ timeout: 3000, tries: 1 });
	resolver.setServers(['1.1.1.1', '8.8.8.8']);
	const codes: string[] = [];
	for (const lookup of [() => resolver.resolve4(host), () => resolver.resolve6(host), () => resolver.resolveCname(host)]) {
		try {
			if ((await lookup()).length) return 'ok';
		} catch (err) {
			codes.push((err as { code?: string }).code ?? '');
		}
	}
	if (codes.every((c) => c === 'ENOTFOUND' || c === 'ENODATA')) return codes.includes('ENOTFOUND') ? 'nxdomain' : 'ok';
	if (codes.every((c) => c === 'ESERVFAIL')) return 'servfail';
	return 'ok';
}

/** El dominio registrable al que se ha acabado llegando, si es otro distinto */
function otherDomain(from: string, to: string): string | null {
	const base = (u: string) => new URL(u).hostname.replace(/^www\./, '').split('.').slice(-2).join('.');
	try {
		return base(from) === base(to) ? null : new URL(to).hostname;
	} catch {
		return null;
	}
}

const withProtocol = (url: URL, protocol: 'http:' | 'https:') => {
	const copy = new URL(url.href);
	copy.protocol = protocol;
	return copy.href;
};

export async function inspect(input: URL): Promise<Inspection> {
	const checkedAt = new Date().toISOString();
	const url = input.href;
	const result: Inspection = { url, finalUrl: null, checkedAt, outcome: 'ok', title: null, evidence: [] };

	// Va primero: suele estar ya caída, y el porqué es justo este
	if (/(^|\.)(negocio|business)\.site$/.test(input.hostname)) {
		result.evidence.push({
			signal: 'web_negocio_site',
			detail: url,
		});
	}

	let res: FetchResult | FetchError = await fetchPage(url);
	let httpsBroken: FetchError | null = null;

	// Con https no carga, pero puede que con http sí: entonces el fallo no es
	// «la web está caída», es «no tiene una conexión segura que funcione».
	if (!res.ok && input.protocol === 'https:' && (res.failure === 'tls' || res.failure === 'timeout' || res.failure === 'network')) {
		const plain = await fetchPage(withProtocol(input, 'http:'));
		if (plain.ok && plain.status < 400) {
			httpsBroken = res;
			res = plain;
		}
	}

	if (!res.ok && res.failure === 'blocked-address') {
		throw new InputError('not_public');
	}

	if (!res.ok && res.failure !== 'tls') {
		// Error de conexión, sin respuesta o «no existe» según el DNS de este
		// servidor: puede ser de esta red y no de la web (lección del radar,
		// 2026-10-21). Solo cuenta como caída si los DNS públicos dicen que el
		// dominio no existe o no resuelve.
		const dns = await publicDns(url);
		if (dns === 'nxdomain') res = { ok: false, failure: 'dns', detail: 'El dominio no existe (comprobado en DNS públicos)' };
		else if (dns === 'servfail') res = { ok: false, failure: 'dns', detail: 'El dominio no resuelve: sus servidores DNS no responden (comprobado en DNS públicos)' };
		else {
			result.outcome = 'unverified';
			result.evidence.push({
				signal: 'web_no_comprobable',
				detail: res.detail,
			});
			return result;
		}
	}
	if (!res.ok) {
		result.outcome = 'down';
		const failure = res.failure as Exclude<FetchError['failure'], 'blocked-address'>;
		// El dominio puede no existir o existir sin que sus DNS respondan
		const vars = failure === 'dns' && res.detail.includes('no resuelve') ? { variant: 'servfail' } : undefined;
		result.evidence.push({ signal: `web_caida_${failure}`, vars, detail: res.detail });
		return result;
	}
	// Un 5xx puede ser pasajero: se repite una vez antes de darlo por bueno
	if (res.status >= 500) {
		await new Promise((r) => setTimeout(r, 1_500));
		const again = await fetchPage(res.finalUrl, 6_000);
		if (again.ok) res = again;
	}

	result.finalUrl = res.finalUrl;
	// 401/403/429: la web rechaza la visita automática (Cloudflare y similares).
	// No es «web caída»: a una persona le puede funcionar. Se dice tal cual.
	if ([401, 403, 429].includes(res.status)) {
		result.outcome = 'blocked';
		result.evidence.push({
			signal: 'web_bloquea_visita',
			vars: { status: String(res.status) },
			detail: `HTTP ${res.status}`,
		});
		return result;
	}
	if (res.status >= 400) {
		result.outcome = 'down';
		result.evidence.push({ signal: 'web_caida_http', vars: { status: String(res.status) }, detail: `HTTP ${res.status}` });
		return result;
	}

	result.evidence.push(...(await securityEvidence(res.finalUrl, httpsBroken)));

	const moved = otherDomain(url, res.finalUrl);
	if (moved) {
		result.evidence.push({ signal: 'web_redirige_otro_dominio', vars: { domain: moved }, detail: res.finalUrl });
	}

	const page = readPage(res.body, res.finalUrl);
	result.title = page.title;
	// Todo lo que hay que abrir aparte (páginas internas, reservas, imagen de
	// la vista previa) va a la vez: la espera es la del más lento, no la suma
	const [internal, booking, preview] = await Promise.all([
		checkInternalLinks(page.internalLinks),
		checkBookingUrls(page.bookingUrls),
		previewEvidence(page),
	]);
	result.evidence.push(...pageEvidence(page, internal.contact), ...internal.evidence, ...booking, ...preview);
	return result;
}

/** ¿Llega la visita por una conexión segura? */
async function securityEvidence(finalUrl: string, httpsBroken: FetchError | null): Promise<Evidence[]> {
	if (httpsBroken) {
		return [
			{
				signal: httpsBroken.failure === 'tls' ? 'https_certificado' : 'sin_https',
				vars: httpsBroken.failure === 'tls' ? undefined : { variant: 'https_no_responde' },
				detail: httpsBroken.detail,
			},
		];
	}
	if (new URL(finalUrl).protocol === 'https:') return [{ signal: 'https_ok' }];

	// Se ha llegado por http: ¿existe la versión segura y simplemente no redirige?
	const secure = await fetchPage(withProtocol(new URL(finalUrl), 'https:'), 5_000);
	if (secure.ok && secure.status < 400) {
		return [{ signal: 'http_sin_redirigir' }];
	}
	return [{ signal: 'sin_https', detail: secure.ok ? `HTTP ${secure.status}` : secure.detail }];
}

function readPage(html: string, pageUrl: string): PageSignals {
	const $ = cheerio.load(html);
	const hrefs = $('a[href]')
		.map((_, a) => $(a).attr('href') ?? '')
		.get();
	const hostOf = (href: string) => {
		try {
			return new URL(href, pageUrl).hostname.toLowerCase().replace(/^www\./, '');
		} catch {
			return '';
		}
	};
	const bookings = bookingUrls($, pageUrl);
	const absolute = (href: string | undefined) => {
		try {
			return href ? new URL(href.trim(), pageUrl).href : null;
		} catch {
			return null;
		}
	};
	const ogImage = absolute($('meta[property="og:image"], meta[name="og:image"], meta[name="twitter:image"]').first().attr('content'));
	const description = $('meta[name="description"]').first().attr('content')?.trim() || null;
	const internal = internalLinks($, pageUrl);

	$('script, style, noscript, template').remove();
	const text = $('body').text().replace(/\s+/g, ' ').trim();

	const years = [...text.matchAll(/(?:©|copyright)\D{0,25}((?:19|20)\d{2})(?:\s*[-–]\s*((?:19|20)\d{2}))?/gi)].flatMap((m) =>
		[m[1], m[2]].filter(Boolean).map(Number),
	);

	return {
		title: $('title').first().text().trim() || null,
		hasViewport: $('meta[name="viewport"]').length > 0,
		telLinks: [...new Set(hrefs.filter((h) => h.toLowerCase().startsWith('tel:')).map((h) => h.slice(4).trim()))],
		phonesInText: findPhones(text),
		mailtoLinks: hrefs.filter((h) => h.toLowerCase().startsWith('mailto:')).length,
		whatsapp: hrefs.some((h) => matchesDomain(hostOf(h), WHATSAPP)) || /wa\.me\/|api\.whatsapp\.com|whatsapp:\/\/|joinchat/i.test(html),
		forms: $('form').length,
		formPlugins: FORM_PLUGINS.filter(([, re]) => re.test(html)).map(([name]) => name),
		bookingLinks: [...new Set(hrefs.filter((h) => matchesDomain(hostOf(h), BOOKING)).map(hostOf))],
		bookingUrls: bookings,
		copyrightYear: years.length ? Math.max(...years) : null,
		description,
		ogImage: ogImage && /^https?:/.test(ogImage) ? ogImage : null,
		internalLinks: internal,
	};
}

const NOT_A_PAGE = /\.(pdf|jpe?g|png|gif|webp|svg|avif|zip|rar|docx?|xlsx?|pptx?|mp4|mp3|ics)$/i;
// /cdn-cgi/: el email protegido de Cloudflare da 404 a un robot pero a una persona le funciona
const SKIP_PATH = /\/(wp-admin|wp-login|feed|cart|carrito|checkout|my-account|mi-cuenta)(\/|$)|^\/cdn-cgi\/|\?(add-to-cart|replytocom)=/i;
const MAX_INTERNAL = 12;

/** Las otras páginas de la web que enlaza la portada (máximo 12, sin repetir) */
function internalLinks($: cheerio.CheerioAPI, pageUrl: string): { url: string; text: string }[] {
	const home = new URL(pageUrl);
	const site = home.hostname.replace(/^www\./, '');
	const seen = new Set([home.href.split('#')[0]]);
	const links: { url: string; text: string }[] = [];
	$('a[href]').each((_, a) => {
		if (links.length >= MAX_INTERNAL) return false;
		let url: URL;
		try {
			url = new URL(($(a).attr('href') ?? '').trim(), pageUrl);
		} catch {
			return;
		}
		url.hash = '';
		if (!/^https?:$/.test(url.protocol) || url.hostname.replace(/^www\./, '') !== site) return;
		if (NOT_A_PAGE.test(url.pathname) || SKIP_PATH.test(url.pathname + url.search) || seen.has(url.href)) return;
		seen.add(url.href);
		links.push({ url: url.href, text: $(a).text().replace(/\s+/g, ' ').trim() });
	});
	return links;
}

const CONTACT = /contact|contacto|contactar|contacta|cont[aá]ctanos|ll[aá]manos|donde-estamos|d[oó]nde estamos|ubicaci[oó]n/i;

interface ContactPage {
	path: string;
	page: PageSignals;
}

/**
 * Las páginas que enlaza la portada, a la vez: ¿alguna está rota? Y, de paso,
 * la de contacto: lo que no está en la portada puede estar ahí.
 * Solo cuentan como rotas las que dan 404/410 o no existen: un fallo de red o
 * una protección contra robots no se puede afirmar como «roto».
 */
async function checkInternalLinks(links: { url: string; text: string }[]): Promise<{ evidence: Evidence[]; contact: ContactPage | null }> {
	if (links.length === 0) return { evidence: [], contact: null };
	const results = await Promise.all(links.map(async (link) => ({ link, res: await fetchPage(link.url, 6_000) })));

	const broken = results.filter(({ res }) => (res.ok ? res.status === 404 || res.status === 410 : res.failure === 'dns'));
	const checked = results.filter(({ res }) => res.ok || res.failure === 'dns');
	const pathOf = (url: string) => {
		const u = new URL(url);
		return decodeURI(u.pathname + u.search);
	};

	const evidence: Evidence[] = [];
	if (broken.length > 0) {
		evidence.push({
			signal: 'enlaces_rotos',
			vars: { count: String(broken.length), total: String(checked.length), examples: broken.slice(0, 2).map(({ link }) => pathOf(link.url)).join(', ') },
			detail: broken.map(({ link, res }) => `${link.url} → ${res.ok ? `HTTP ${res.status}` : res.detail}`).join('; '),
		});
	} else if (checked.length > 0) {
		evidence.push({ signal: 'enlaces_ok', vars: { total: String(checked.length) } });
	}

	const contactHit = results.find(
		({ link, res }) => (CONTACT.test(link.text) || CONTACT.test(new URL(link.url).pathname)) && res.ok && res.status < 400 && res.body,
	);
	const contact =
		contactHit && contactHit.res.ok ? { path: pathOf(contactHit.res.finalUrl), page: readPage(contactHit.res.body, contactHit.res.finalUrl) } : null;
	return { evidence, contact };
}

const GENERIC_TITLE = /^(inicio|home|homepage|index|p[aá]gina principal|portada|untitled|sin t[ií]tulo|mi sitio|my site|my wordpress blog|bienvenid[oa]s?|welcome|just another wordpress site)$/i;

/** Lo que se ve de la web antes de entrar: en Google y al compartir el enlace */
async function previewEvidence(p: PageSignals): Promise<Evidence[]> {
	const ev: Evidence[] = [];
	const title = p.title?.replace(/\s+/g, ' ').trim() ?? '';
	if (!title) ev.push({ signal: 'sin_titulo' });
	// Genérico solo si no dice nada más: «Inicio - Peluquería Pilar» ya lleva el nombre
	else if (GENERIC_TITLE.test(title)) ev.push({ signal: 'titulo_generico', vars: { title } });
	else ev.push({ signal: 'titulo_ok', vars: { title: title.length > 70 ? `${title.slice(0, 67)}…` : title } });
	if (title && !p.description) ev.push({ signal: 'sin_descripcion' });

	if (!p.ogImage) {
		ev.push({ signal: 'sin_vista_previa' });
	} else {
		const res = await fetchPage(p.ogImage, 6_000);
		const broken = res.ok ? res.status === 404 || res.status === 410 || (res.status < 400 && !res.contentType.startsWith('image/')) : res.failure === 'dns' || res.failure === 'tls';
		ev.push(broken ? { signal: 'imagen_compartir_rota', detail: p.ogImage } : { signal: 'vista_previa_ok' });
	}
	return ev;
}

const BOOKING_TEXT = /reserv|pedir cita|pide (tu )?cita|solicitar cita|cita (previa|online)|book (now|online|an appointment)/i;

/** Enlaces de reserva: a una plataforma conocida o con un texto de reserva (máximo 3) */
function bookingUrls($: cheerio.CheerioAPI, pageUrl: string): string[] {
	const urls = new Set<string>();
	$('a[href]').each((_, a) => {
		const href = $(a).attr('href') ?? '';
		let url: URL;
		try {
			url = new URL(href, pageUrl);
		} catch {
			return;
		}
		if (!/^https?:$/.test(url.protocol)) return;
		const host = url.hostname.replace(/^www\./, '');
		if (matchesDomain(host, BOOKING) || BOOKING_TEXT.test($(a).text())) urls.add(url.href.split('#')[0]);
	});
	return [...urls].filter((u) => u !== pageUrl.split('#')[0]).slice(0, 3);
}

/**
 * ¿Funcionan los botones de reserva? Se comprueban a la vez para no alargar la
 * espera. 401/403/429 no cuentan: suelen ser protecciones contra robots.
 */
async function checkBookingUrls(urls: string[]): Promise<Evidence[]> {
	const results = await Promise.all(urls.map(async (url) => ({ url, res: await fetchPage(url, 6_000) })));
	const ev: Evidence[] = [];
	for (const { url, res } of results) {
		const broken = !res.ok ? res.failure !== 'timeout' && res.failure !== 'blocked-address' : res.status === 404 || res.status === 410 || res.status >= 500;
		if (broken) {
			const detail = res.ok ? `HTTP ${res.status}` : res.detail;
			ev.push({ signal: 'enlace_reserva_roto', detail: `${url} → ${detail}` });
		}
	}
	return ev;
}

/** Teléfonos españoles de 9 cifras escritos en el texto */
function findPhones(text: string): string[] {
	const found = new Set<string>();
	for (const m of text.matchAll(/(?:\+34[\s.-]?)?(?<!\d)[6789]\d{2}(?:[\s.-]?\d{2,3}){2,3}(?!\d)/g)) {
		const digits = m[0].replace(/\D/g, '').replace(/^34(?=\d{9}$)/, '');
		if (digits.length === 9) found.add(digits);
	}
	return [...found];
}

const formatPhone = (digits: string) => digits.replace(/^(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3');

const hasContact = (p: PageSignals) =>
	p.telLinks.length > 0 || p.phonesInText.length > 0 || p.whatsapp || p.mailtoLinks > 0 || p.forms > 0 || p.formPlugins.length > 0;

/** El teléfono de una página: pulsable, escrito sin enlace o ninguno */
function phoneEvidence(p: PageSignals, path?: string): Evidence | null {
	const telDigits = new Set(p.telLinks.map((t) => t.replace(/\D/g, '').replace(/^34(?=\d{9}$)/, '')));
	const unlinked = p.phonesInText.filter((n) => !telDigits.has(n));
	const where: Record<string, string> = path ? { path } : {};
	if (p.telLinks.length === 0 && unlinked.length > 0) {
		return { signal: 'telefono_sin_enlace', vars: { phone: formatPhone(unlinked[0]), ...where }, detail: unlinked[0] };
	}
	if (p.telLinks.length > 0) return { signal: 'telefono_pulsable', vars: path ? where : undefined };
	return null;
}

function pageEvidence(p: PageSignals, contact: ContactPage | null): Evidence[] {
	const ev: Evidence[] = [];

	// Sin teléfono en la portada, cuenta el de la página de contacto
	const phone = phoneEvidence(p) ?? (contact ? phoneEvidence(contact.page, contact.path) : null);
	if (phone) ev.push(phone);

	if (!hasContact(p)) {
		if (contact && hasContact(contact.page)) ev.push({ signal: 'contacto_fuera_de_portada', vars: { path: contact.path } });
		else ev.push({ signal: 'sin_contacto_en_portada', vars: contact ? { path: contact.path } : undefined });
	}
	ev.push(
		p.hasViewport
			? { signal: 'movil_ok' }
			: { signal: 'sin_viewport' },
	);
	if (p.copyrightYear !== null && new Date().getFullYear() - p.copyrightYear >= 3) {
		ev.push({ signal: 'copyright_antiguo', vars: { year: String(p.copyrightYear) } });
	}
	if (p.bookingLinks.length > 0) {
		ev.push({ signal: 'reserva_online', vars: { platforms: p.bookingLinks.join(', ') } });
	}
	if (p.whatsapp) {
		ev.push({ signal: 'whatsapp' });
	}
	return ev;
}
