import type { Lang } from './senales.ts';

/**
 * Enlaces a felixcorcoran.es, en el idioma de la página. Los que llevan
 * data-site-link pasan el tema elegido (?tema=oscuro|claro) para que la otra
 * web se vea igual. Las legales de la landing solo existen en español.
 */
export const site = (lang: Lang) => ({
	home: lang === 'en' ? 'https://felixcorcoran.es/en' : 'https://felixcorcoran.es/',
	work: lang === 'en' ? 'https://felixcorcoran.es/en#work' : 'https://felixcorcoran.es/#trabajo',
	contact: lang === 'en' ? 'https://felixcorcoran.es/en/contact' : 'https://felixcorcoran.es/contacto',
	legal: 'https://felixcorcoran.es/aviso-legal',
	privacy: 'https://felixcorcoran.es/privacidad',
	email: 'contacto@felixcorcoran.es',
	/** La otra herramienta gratuita: el radar de subvenciones (solo en español) */
	subvenciones: 'https://subvenciones.felixcorcoran.es/',
});

/** Esta misma herramienta en cada idioma */
export const paths: Record<Lang, string> = { es: '/', en: '/en' };
