/**
 * Qué se enseña de cada señal y por qué importa. El hecho lo escribe el
 * código (src/lib/inspect.ts); aquí solo va el texto fijo que lo explica.
 *
 * Regla de felixcorcoran.es: cada frase tiene que poder responder «¿cómo sé
 * esto?». Aquí se explica qué le pasa a quien visita la web, no cuántos
 * clientes se pierden: eso no se puede saber desde fuera.
 *
 * Una señal que no esté aquí no se enseña (las que el radar usa por dentro,
 * como la versión en inglés).
 */

export type Nivel = 'fallo' | 'aviso' | 'bien' | 'neutro';

export interface Senal {
	nivel: Nivel;
	/** Titular corto del hallazgo */
	titulo: string;
	/** Por qué importa, en una o dos frases */
	porQue: string;
}

const caida = 'Quien busca el negocio y pulsa en la web se encuentra un error. Es lo primero que conviene arreglar.';

export const senales: Record<string, Senal> = {
	web_caida_dns: { nivel: 'fallo', titulo: 'La web no carga', porQue: caida },
	web_caida_timeout: { nivel: 'fallo', titulo: 'La web no responde', porQue: caida },
	web_caida_tls: { nivel: 'fallo', titulo: 'La web no carga', porQue: caida },
	web_caida_network: { nivel: 'fallo', titulo: 'La web no carga', porQue: caida },
	web_caida_http: { nivel: 'fallo', titulo: 'La web da error', porQue: caida },
	web_no_comprobable: {
		nivel: 'neutro',
		titulo: 'No se ha podido comprobar',
		porQue: 'Puede ser un fallo de la web o de la conexión desde aquí. Ábrela tú desde el móvil para salir de dudas.',
	},
	web_bloquea_visita: {
		nivel: 'neutro',
		titulo: 'La web no deja leerla',
		porQue: 'Tiene una protección contra visitas automáticas. A una persona le puede funcionar bien, pero aquí no se puede afirmar nada más.',
	},
	web_negocio_site: {
		nivel: 'fallo',
		titulo: 'Web en un servicio cerrado',
		porQue: 'Google dejó de mantener las webs de negocio.site. Si todavía la enlazas desde algún sitio, quien la abra no encontrará tu negocio.',
	},
	web_redirige_otro_dominio: {
		nivel: 'aviso',
		titulo: 'Lleva a otro dominio',
		porQue: 'Puede ser a propósito (una marca nueva, una plataforma). Si no lo es, quien escribe tu dirección acaba en otra web.',
	},
	sin_https: {
		nivel: 'fallo',
		titulo: 'Sin conexión segura',
		porQue: 'Los navegadores marcan estas webs como «No seguro» junto a la dirección. Y si hay un formulario, los datos viajan sin cifrar.',
	},
	https_certificado: {
		nivel: 'fallo',
		titulo: 'El certificado falla',
		porQue: 'Quien entra con https:// ve una pantalla de aviso de seguridad antes que tu web.',
	},
	http_sin_redirigir: {
		nivel: 'aviso',
		titulo: 'No pasa sola a https',
		porQue: 'La versión segura existe, pero quien llega por un enlace antiguo con http:// la ve marcada como «No seguro».',
	},
	https_ok: { nivel: 'bien', titulo: 'Conexión segura', porQue: 'El navegador no muestra avisos al entrar.' },
	telefono_sin_enlace: {
		nivel: 'fallo',
		titulo: 'El teléfono no se puede pulsar',
		porQue: 'En el móvil, para llamar hay que copiar el número a mano. Con un enlace, se llama con un toque.',
	},
	telefono_pulsable: { nivel: 'bien', titulo: 'Teléfono pulsable', porQue: 'Desde el móvil se llama sin copiar el número.' },
	sin_contacto_en_portada: {
		nivel: 'fallo',
		titulo: 'Sin forma de contacto en la portada',
		porQue: 'Quien entra con ganas de llamar o escribir tiene que ir a buscar cómo. Solo se ha mirado la portada: puede que esté en otra página.',
	},
	sin_viewport: {
		nivel: 'fallo',
		titulo: 'No está preparada para el móvil',
		porQue: 'En el móvil se ve como una web de ordenador en pequeño: hay que hacer zoom para leer y para pulsar.',
	},
	movil_ok: { nivel: 'bien', titulo: 'Preparada para el móvil', porQue: 'La página se adapta al ancho de la pantalla.' },
	enlace_reserva_roto: {
		nivel: 'fallo',
		titulo: 'Un enlace de reserva no funciona',
		porQue: 'Quien quiere reservar pulsa y llega a un error, justo en el momento en que ya se había decidido.',
	},
	copyright_antiguo: {
		nivel: 'aviso',
		titulo: 'El pie tiene un año antiguo',
		porQue: 'Es un detalle pequeño, pero a quien entra le puede dar la impresión de que la web no se cuida.',
	},
	reserva_online: { nivel: 'bien', titulo: 'Reserva online', porQue: 'Se puede reservar sin llamar.' },
	whatsapp: { nivel: 'bien', titulo: 'WhatsApp', porQue: 'Se puede escribir directamente desde la web.' },
};

/** Lo que esta comprobación no mira: se dice siempre, para no prometer de más */
export const noComprobado = [
	'Solo se ha mirado la portada, no el resto de páginas.',
	'No se ha mirado la ficha de Google (reseñas, horario, fotos).',
	'No se ha medido la velocidad ni se ha probado el formulario.',
	'No se sabe qué pasa después de que alguien contacta: si se responde, cuánto se tarda, cómo se organiza.',
];
