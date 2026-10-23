/**
 * Qué se enseña de cada señal, en español y en inglés: el hecho (con los datos
 * que ha encontrado el código: teléfono, año, dominio…), un titular y por qué
 * importa.
 *
 * Regla de felixcorcoran.es: cada frase tiene que poder responder «¿cómo sé
 * esto?». Aquí se explica qué le pasa a quien visita la web, no cuántos
 * clientes se pierden: eso no se puede saber desde fuera.
 *
 * Una señal que no esté aquí no se enseña (las que el radar usa por dentro,
 * como la versión en inglés).
 */

import type { Evidence, InputErrorCode } from '../lib/inspect.ts';

export type Lang = 'es' | 'en';
export type Nivel = 'fallo' | 'aviso' | 'bien' | 'neutro';
type Vars = Record<string, string>;

interface Texto {
	titulo: string;
	porQue: string;
	hecho: (v: Vars) => string;
}

export const niveles: Record<string, Nivel> = {
	web_caida_dns: 'fallo',
	web_caida_timeout: 'fallo',
	web_caida_tls: 'fallo',
	web_caida_network: 'fallo',
	web_caida_http: 'fallo',
	web_no_comprobable: 'neutro',
	web_bloquea_visita: 'neutro',
	web_negocio_site: 'fallo',
	web_redirige_otro_dominio: 'aviso',
	sin_https: 'fallo',
	https_certificado: 'fallo',
	http_sin_redirigir: 'aviso',
	https_ok: 'bien',
	telefono_sin_enlace: 'fallo',
	telefono_pulsable: 'bien',
	sin_contacto_en_portada: 'fallo',
	sin_viewport: 'fallo',
	movil_ok: 'bien',
	enlace_reserva_roto: 'fallo',
	copyright_antiguo: 'aviso',
	reserva_online: 'bien',
	whatsapp: 'bien',
};

const caidaEs = 'Quien busca el negocio y pulsa en la web se encuentra un error. Es lo primero que conviene arreglar.';
const caidaEn = 'Anyone who looks up the business and clicks through to the website gets an error. This is the first thing to fix.';

const es: Record<string, Texto> = {
	web_caida_dns: {
		titulo: 'La web no carga',
		porQue: caidaEs,
		hecho: (v) => (v.variant === 'servfail' ? 'El dominio de la web no resuelve: no le carga a nadie.' : 'El dominio de la web no existe.'),
	},
	web_caida_timeout: { titulo: 'La web no responde', porQue: caidaEs, hecho: () => 'La web no responde.' },
	web_caida_tls: { titulo: 'La web no carga', porQue: caidaEs, hecho: () => 'La web da un error de certificado y no carga ni con http.' },
	web_caida_network: { titulo: 'La web no carga', porQue: caidaEs, hecho: () => 'La web no carga (error de red).' },
	web_caida_http: { titulo: 'La web da error', porQue: caidaEs, hecho: (v) => `La web devuelve un error ${v.status}.` },
	web_no_comprobable: {
		titulo: 'No se ha podido comprobar',
		porQue: 'Puede ser un fallo de la web o de la conexión desde aquí. Ábrela tú desde el móvil para salir de dudas.',
		hecho: () => 'No se ha podido abrir la web desde aquí, aunque el dominio existe.',
	},
	web_bloquea_visita: {
		titulo: 'La web no deja leerla',
		porQue: 'Tiene una protección contra visitas automáticas. A una persona le puede funcionar bien, pero aquí no se puede afirmar nada más.',
		hecho: (v) => `La web rechaza las visitas automáticas (HTTP ${v.status}), así que no se ha podido leer.`,
	},
	web_negocio_site: {
		titulo: 'Web en un servicio cerrado',
		porQue: 'Google dejó de mantener las webs de negocio.site. Si todavía la enlazas desde algún sitio, quien la abra no encontrará tu negocio.',
		hecho: () => 'La web está en negocio.site, un servicio de Google que cerró en 2024.',
	},
	web_redirige_otro_dominio: {
		titulo: 'Lleva a otro dominio',
		porQue: 'Puede ser a propósito (una marca nueva, una plataforma). Si no lo es, quien escribe tu dirección acaba en otra web.',
		hecho: (v) => `La dirección lleva a otro dominio (${v.domain}).`,
	},
	sin_https: {
		titulo: 'Sin conexión segura',
		porQue: 'Los navegadores marcan estas webs como «No seguro» junto a la dirección. Y si hay un formulario, los datos viajan sin cifrar.',
		hecho: (v) =>
			v.variant === 'https_no_responde'
				? 'La web no responde con https://; solo carga con http://, sin conexión segura.'
				: 'La web solo carga con http://, sin conexión segura.',
	},
	https_certificado: {
		titulo: 'El certificado falla',
		porQue: 'Quien entra con https:// ve una pantalla de aviso de seguridad antes que tu web.',
		hecho: () => 'Con https:// la web da un error de certificado; solo carga con http://, sin conexión segura.',
	},
	http_sin_redirigir: {
		titulo: 'No pasa sola a https',
		porQue: 'La versión segura existe, pero quien llega por un enlace antiguo con http:// la ve marcada como «No seguro».',
		hecho: () => 'Con http:// la web no pasa sola a https://, aunque la versión segura existe.',
	},
	https_ok: { titulo: 'Conexión segura', porQue: 'El navegador no muestra avisos al entrar.', hecho: () => 'La web carga con conexión segura (https).' },
	telefono_sin_enlace: {
		titulo: 'El teléfono no se puede pulsar',
		porQue: 'En el móvil, para llamar hay que copiar el número a mano. Con un enlace, se llama con un toque.',
		hecho: (v) => `El teléfono ${v.phone} aparece como texto, sin enlace para llamar.`,
	},
	telefono_pulsable: {
		titulo: 'Teléfono pulsable',
		porQue: 'Desde el móvil se llama sin copiar el número.',
		hecho: () => 'El teléfono tiene enlace: en el móvil se llama con un toque.',
	},
	sin_contacto_en_portada: {
		titulo: 'Sin forma de contacto en la portada',
		porQue: 'Quien entra con ganas de llamar o escribir tiene que ir a buscar cómo. Solo se ha mirado la portada: puede que esté en otra página.',
		hecho: () => 'La portada no tiene teléfono, WhatsApp, email ni formulario.',
	},
	sin_viewport: {
		titulo: 'No está preparada para el móvil',
		porQue: 'En el móvil se ve como una web de ordenador en pequeño: hay que hacer zoom para leer y para pulsar.',
		hecho: () => 'La página no declara viewport: no está preparada para verse en el móvil.',
	},
	movil_ok: {
		titulo: 'Preparada para el móvil',
		porQue: 'La página se adapta al ancho de la pantalla.',
		hecho: () => 'La página declara que está preparada para móvil (viewport).',
	},
	enlace_reserva_roto: {
		titulo: 'Un enlace de reserva no funciona',
		porQue: 'Quien quiere reservar pulsa y llega a un error, justo en el momento en que ya se había decidido.',
		hecho: () => 'Un enlace de reserva o cita de la portada no funciona.',
	},
	copyright_antiguo: {
		titulo: 'El pie tiene un año antiguo',
		porQue: 'Es un detalle pequeño, pero a quien entra le puede dar la impresión de que la web no se cuida.',
		hecho: (v) => `El pie de la web dice © ${v.year}.`,
	},
	reserva_online: { titulo: 'Reserva online', porQue: 'Se puede reservar sin llamar.', hecho: (v) => `Enlaza a reservas online (${v.platforms}).` },
	whatsapp: { titulo: 'WhatsApp', porQue: 'Se puede escribir directamente desde la web.', hecho: () => 'La portada tiene enlace o botón de WhatsApp.' },
};

const en: Record<string, Texto> = {
	web_caida_dns: {
		titulo: "The website doesn't load",
		porQue: caidaEn,
		hecho: (v) => (v.variant === 'servfail' ? "The website's domain doesn't resolve: it won't load for anyone." : "The website's domain doesn't exist."),
	},
	web_caida_timeout: { titulo: "The website doesn't respond", porQue: caidaEn, hecho: () => "The website doesn't respond." },
	web_caida_tls: { titulo: "The website doesn't load", porQue: caidaEn, hecho: () => "The website has a certificate error and doesn't load over http either." },
	web_caida_network: { titulo: "The website doesn't load", porQue: caidaEn, hecho: () => "The website doesn't load (network error)." },
	web_caida_http: { titulo: 'The website shows an error', porQue: caidaEn, hecho: (v) => `The website returns a ${v.status} error.` },
	web_no_comprobable: {
		titulo: "Couldn't be checked",
		porQue: 'It could be a problem with the website or with the connection from here. Open it on your phone to be sure.',
		hecho: () => "The website couldn't be opened from here, although the domain exists.",
	},
	web_bloquea_visita: {
		titulo: "The website can't be read",
		porQue: "It's protected against automated visits. It may work fine for a person, but nothing more can be said from here.",
		hecho: (v) => `The website rejects automated visits (HTTP ${v.status}), so it couldn't be read.`,
	},
	web_negocio_site: {
		titulo: 'Website on a closed service',
		porQue: "Google stopped running negocio.site websites. If you still link to it anywhere, whoever opens it won't find your business.",
		hecho: () => 'The website is on negocio.site, a Google service that shut down in 2024.',
	},
	web_redirige_otro_dominio: {
		titulo: 'Goes to another domain',
		porQue: "It may be on purpose (a new brand, a platform). If not, people who type your address end up on another website.",
		hecho: (v) => `The address leads to another domain (${v.domain}).`,
	},
	sin_https: {
		titulo: 'No secure connection',
		porQue: 'Browsers mark these websites as "Not secure" next to the address. And if there is a form, the data travels unencrypted.',
		hecho: (v) =>
			v.variant === 'https_no_responde'
				? "The website doesn't respond over https://; it only loads over http://, without a secure connection."
				: 'The website only loads over http://, without a secure connection.',
	},
	https_certificado: {
		titulo: 'The certificate fails',
		porQue: 'Anyone visiting over https:// sees a security warning screen before your website.',
		hecho: () => 'Over https:// the website gives a certificate error; it only loads over http://, without a secure connection.',
	},
	http_sin_redirigir: {
		titulo: "Doesn't switch to https",
		porQue: 'The secure version exists, but anyone arriving through an old http:// link sees it marked as "Not secure".',
		hecho: () => "Over http:// the website doesn't switch to https:// on its own, although the secure version exists.",
	},
	https_ok: { titulo: 'Secure connection', porQue: 'The browser shows no warnings.', hecho: () => 'The website loads over a secure connection (https).' },
	telefono_sin_enlace: {
		titulo: "The phone number can't be tapped",
		porQue: 'On a phone, people have to copy the number by hand to call. With a link, they call with one tap.',
		hecho: (v) => `The phone number ${v.phone} appears as plain text, with no link to call.`,
	},
	telefono_pulsable: {
		titulo: 'Tappable phone number',
		porQue: 'On a phone, people can call without copying the number.',
		hecho: () => 'The phone number has a link: on a phone, it calls with one tap.',
	},
	sin_contacto_en_portada: {
		titulo: 'No way to get in touch on the home page',
		porQue: "Anyone who wants to call or write has to go looking for how. Only the home page was checked: it may be on another page.",
		hecho: () => 'The home page has no phone number, WhatsApp, email or form.',
	},
	sin_viewport: {
		titulo: "Not ready for phones",
		porQue: 'On a phone it looks like a tiny desktop website: people have to zoom in to read and tap.',
		hecho: () => "The page doesn't declare a viewport: it isn't set up to display on phones.",
	},
	movil_ok: {
		titulo: 'Ready for phones',
		porQue: 'The page adapts to the width of the screen.',
		hecho: () => 'The page declares that it is set up for phones (viewport).',
	},
	enlace_reserva_roto: {
		titulo: 'A booking link is broken',
		porQue: 'People who want to book tap it and get an error, right when they had made up their mind.',
		hecho: () => "A booking or appointment link on the home page doesn't work.",
	},
	copyright_antiguo: {
		titulo: 'The footer shows an old year',
		porQue: "It's a small detail, but visitors may get the impression the website isn't looked after.",
		hecho: (v) => `The website's footer says © ${v.year}.`,
	},
	reserva_online: { titulo: 'Online booking', porQue: 'People can book without calling.', hecho: (v) => `It links to online booking (${v.platforms}).` },
	whatsapp: { titulo: 'WhatsApp', porQue: 'People can message you straight from the website.', hecho: () => 'The home page has a WhatsApp link or button.' },
};

const textos: Record<Lang, Record<string, Texto>> = { es, en };

export interface Hallazgo {
	senal: string;
	nivel: Nivel;
	titulo: string;
	porQue: string;
	hecho: string;
}

const ORDER: Record<Nivel, number> = { fallo: 0, aviso: 1, neutro: 2, bien: 3 };

/** Los hechos del código, con sus textos en el idioma de la página y en orden */
export function describe(evidence: Evidence[], lang: Lang): Hallazgo[] {
	return evidence
		.filter((e) => e.signal in niveles)
		.map((e) => {
			const t = textos[lang][e.signal];
			return { senal: e.signal, nivel: niveles[e.signal], titulo: t.titulo, porQue: t.porQue, hecho: t.hecho(e.vars ?? {}) };
		})
		.sort((a, b) => ORDER[a.nivel] - ORDER[b.nivel]);
}

/** Lo que esta comprobación no mira: se dice siempre, para no prometer de más */
export const noComprobado: Record<Lang, string[]> = {
	es: [
		'Solo se ha mirado la portada, no el resto de páginas.',
		'No se ha mirado la ficha de Google (reseñas, horario, fotos).',
		'No se ha medido la velocidad ni se ha probado el formulario.',
		'No se sabe qué pasa después de que alguien contacta: si se responde, cuánto se tarda, cómo se organiza.',
	],
	en: [
		'Only the home page was checked, not the other pages.',
		"Your Google profile wasn't checked (reviews, opening hours, photos).",
		"Speed wasn't measured and the form wasn't tested.",
		"There's no way to know what happens after someone gets in touch: whether they get a reply, how long it takes, how it's handled.",
	],
};

/** Errores que ve la persona, en su idioma */
export const errores: Record<Lang, Record<InputErrorCode | 'rate' | 'server', string>> = {
	es: {
		empty: 'Escribe la dirección de una web, por ejemplo mipeluqueria.es.',
		invalid: 'Esa dirección no parece una web. Prueba con algo como mipeluqueria.es.',
		not_public: 'Esa dirección no es una web pública.',
		social: 'Eso es un perfil de red social. Esta herramienta comprueba webs propias.',
		booking: 'Eso es una plataforma de reservas. Esta herramienta comprueba webs propias.',
		whatsapp: 'Eso es un enlace de WhatsApp. Esta herramienta comprueba webs propias.',
		rate: 'Has hecho varias comprobaciones seguidas. Espera unos minutos y vuelve a probar.',
		server: 'Algo ha fallado al hacer la comprobación. Vuelve a probar en un momento.',
	},
	en: {
		empty: 'Type a website address, for example myhairsalon.com.',
		invalid: "That doesn't look like a website. Try something like myhairsalon.com.",
		not_public: "That address isn't a public website.",
		social: 'That is a social media profile. This tool checks your own website.',
		booking: 'That is a booking platform. This tool checks your own website.',
		whatsapp: 'That is a WhatsApp link. This tool checks your own website.',
		rate: "You've run several checks in a row. Wait a few minutes and try again.",
		server: 'Something went wrong while checking. Try again in a moment.',
	},
};
