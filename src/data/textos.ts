import type { Lang, Nivel } from './senales.ts';

/** Los textos de la página. Los de cada hallazgo están en senales.ts. */
export const textos = {
	es: {
		title: 'Diagnóstico de tu web · felixcorcoran',
		description:
			'Escribe la dirección de tu web y comprueba qué se encuentra un cliente al entrar: si carga, si es segura, si el teléfono se puede pulsar en el móvil. Solo lo que se puede demostrar.',
		locale: 'es_ES',
		nav: { label: 'Principal', home: 'felixcorcoran — inicio', dark: 'Modo oscuro', work: 'Trabajo', contact: 'Contacto' },
		heading: '¿Qué se encuentra un cliente al entrar en tu web?',
		lead: 'Escribe la dirección. Se comprueba la portada y solo se dice lo que se puede demostrar.',
		inputLabel: 'Dirección de tu web',
		placeholder: 'mipeluqueria.es',
		submit: 'Comprobar',
		hint: 'La dirección que escribes solo se usa para hacer la comprobación. No se guarda.',
		result: 'Resultado',
		limits: 'Lo que no se ha comprobado',
		ctaTitle: 'Esto es lo que se ve desde fuera.',
		ctaText:
			'Si quieres que mire tu negocio por dentro, cuéntame un poco de él y qué te gustaría mejorar. Te enseño hasta 3 oportunidades concretas. Gratis y sin compromiso.',
		ctaLink: 'Solicitar auditoría gratuita',
		footer: { legal: 'Aviso legal', privacy: 'Privacidad', other: 'English', subvenciones: 'Radar de subvenciones' },
		client: {
			tags: { fallo: 'Arreglar', aviso: 'Revisar', neutro: 'Sin datos', bien: 'Bien' } satisfies Record<Nivel, string>,
			checking: 'Comprobando {url}… Suele tardar unos segundos.',
			empty: 'Escribe la dirección de tu web, por ejemplo mipeluqueria.es.',
			offline: 'No se ha podido conectar. Revisa tu conexión y vuelve a probar.',
			failed: 'No se ha podido hacer la comprobación.',
			down: 'La web no carga. Lo demás no se ha podido mirar.',
			unread: 'No se ha podido leer la portada.',
			nothing: 'Nada que arreglar en lo que se ha mirado',
			fix: ['cosa que arreglar', 'cosas que arreglar'],
			review: ['cosa que revisar', 'cosas que revisar'],
			good: ['cosa bien', 'cosas bien'],
			speedTag: 'Midiendo',
			speedTitle: 'Velocidad en móvil',
			speedFact: 'Midiendo con PageSpeed de Google. Tarda unos 20 segundos.',
		},
	},
	en: {
		title: 'Website check · felixcorcoran',
		description:
			'Type your website address and see what a customer finds when they visit: whether it loads, whether it is secure, whether the phone number can be tapped on a phone. Only what can be proven.',
		locale: 'en_GB',
		nav: { label: 'Main', home: 'felixcorcoran — home', dark: 'Dark mode', work: 'Work', contact: 'Contact' },
		heading: 'What does a customer find when they visit your website?',
		lead: 'Type the address. The home page is checked, and you only get what can be proven.',
		inputLabel: 'Your website address',
		placeholder: 'myhairsalon.com',
		submit: 'Check',
		hint: "The address you type is only used to run the check. It isn't stored.",
		result: 'Result',
		limits: "What wasn't checked",
		ctaTitle: 'This is what can be seen from the outside.',
		ctaText:
			"If you'd like me to look at your business from the inside, tell me a bit about it and what you'd like to improve. I'll show you up to 3 concrete opportunities. Free, no strings attached.",
		ctaLink: 'Request a free audit',
		footer: { legal: 'Legal notice', privacy: 'Privacy', other: 'Español', subvenciones: 'Grants radar (in Spanish)' },
		client: {
			tags: { fallo: 'Fix', aviso: 'Review', neutro: 'No data', bien: 'Good' } satisfies Record<Nivel, string>,
			checking: 'Checking {url}… It usually takes a few seconds.',
			empty: 'Type your website address, for example myhairsalon.com.',
			offline: "Couldn't connect. Check your connection and try again.",
			failed: "The check couldn't be run.",
			down: "The website doesn't load. Nothing else could be checked.",
			unread: "The home page couldn't be read.",
			nothing: 'Nothing to fix in what was checked',
			fix: ['thing to fix', 'things to fix'],
			review: ['thing to review', 'things to review'],
			good: ['thing done right', 'things done right'],
			speedTag: 'Measuring',
			speedTitle: 'Mobile speed',
			speedFact: 'Measuring with Google PageSpeed. It takes about 20 seconds.',
		},
	},
} satisfies Record<Lang, unknown>;

export type ClientTexts = (typeof textos)['es']['client'];
