/** Lo que el diagnóstico lee de una página, sin pedir nada a la red */
import { describe, expect, it } from 'vitest';
import { InputError, findPhones, normalizeInput, otherDomain, readPage } from '../src/lib/inspect';

const URL_BASE = 'https://mipeluqueria.es/';

const pagina = (cuerpo: string, cabeza = '') => `<!doctype html><html><head>${cabeza}</head><body>${cuerpo}</body></html>`;

describe('normalizeInput: lo que escribe la persona', () => {
	it('sin protocolo, prueba https y quita el #', () => {
		expect(normalizeInput('  mipeluqueria.es ').href).toBe('https://mipeluqueria.es/');
		expect(normalizeInput('http://www.ejemplo.com/#inicio').href).toBe('http://www.ejemplo.com/');
	});

	const codigo = (raw: string) => {
		try {
			normalizeInput(raw);
			return 'ok';
		} catch (err) {
			return (err as InputError).code;
		}
	};

	it('vacío, con espacios o demasiado largo', () => {
		expect(codigo('')).toBe('empty');
		expect(codigo('mi peluqueria.es')).toBe('empty');
		expect(codigo(`${'a'.repeat(300)}.es`)).toBe('empty');
	});

	it('redes sociales, plataformas de reservas y WhatsApp no son una web propia', () => {
		expect(codigo('instagram.com/mipeluqueria')).toBe('social');
		expect(codigo('https://www.booksy.com/es-es/123')).toBe('booking');
		expect(codigo('wa.me/34600000000')).toBe('whatsapp');
	});

	it('direcciones internas, no', () => {
		expect(codigo('localhost')).toBe('not_public');
		expect(codigo('http://192.168.1.1')).toBe('not_public');
	});
});

describe('readPage', () => {
	it('título, descripción, viewport y vista previa', () => {
		const p = readPage(
			pagina(
				'',
				'<title> Peluquería Ana </title><meta name="viewport" content="width=device-width"><meta name="description" content="Cortes y color en Málaga"><meta property="og:image" content="/img/portada.jpg">',
			),
			URL_BASE,
		);
		expect(p.title).toBe('Peluquería Ana');
		expect(p.hasViewport).toBe(true);
		expect(p.description).toBe('Cortes y color en Málaga');
		expect(p.ogImage).toBe('https://mipeluqueria.es/img/portada.jpg');
	});

	it('teléfonos: pulsables y escritos sin enlace', () => {
		const p = readPage(pagina('<a href="tel:+34952123456">Llámanos</a><p>Móvil: 600 12 34 56</p>'), URL_BASE);
		expect(p.telLinks).toEqual(['+34952123456']);
		expect(p.phonesInText).toContain('600123456');
	});

	it('formas de contacto: correo, formulario, WhatsApp', () => {
		const p = readPage(pagina('<a href="mailto:hola@x.es">Escríbenos</a><form></form><a href="https://wa.me/34600000000">WhatsApp</a>'), URL_BASE);
		expect(p.mailtoLinks).toBe(1);
		expect(p.forms).toBe(1);
		expect(p.whatsapp).toBe(true);
	});

	it('formularios que pinta un plugin con JavaScript', () => {
		const p = readPage(pagina('<div class="wpcf7"></div>'), URL_BASE);
		expect(p.formPlugins).toContain('Contact Form 7');
	});

	it('enlaces a plataformas de reservas', () => {
		const p = readPage(pagina('<a href="https://booksy.com/es-es/123_ana">Reserva tu cita</a>'), URL_BASE);
		expect(p.bookingLinks).toEqual(['booksy.com']);
	});

	it('el año de copyright más reciente, también en rangos', () => {
		expect(readPage(pagina('<footer>© 2019 Peluquería Ana</footer>'), URL_BASE).copyrightYear).toBe(2019);
		expect(readPage(pagina('<footer>Copyright 2018 - 2024</footer>'), URL_BASE).copyrightYear).toBe(2024);
		expect(readPage(pagina('<footer>Peluquería Ana</footer>'), URL_BASE).copyrightYear).toBeNull();
	});

	it('el texto de scripts y estilos no cuenta como contenido', () => {
		const p = readPage(pagina('<script>var tel = "600 11 22 33"; // © 2001</script><p>Hola</p>'), URL_BASE);
		expect(p.phonesInText).toEqual([]);
		expect(p.copyrightYear).toBeNull();
	});
});

describe('findPhones', () => {
	it('fijos y móviles españoles, con prefijo o sin él, sin repetir', () => {
		expect(findPhones('Tel. 952 12 34 56 · +34 600-123-456 · 600123456')).toEqual(['952123456', '600123456']);
	});

	it('números que no son teléfonos, no', () => {
		expect(findPhones('Código postal 29600, CIF B12345678, 12 de octubre de 2026')).toEqual([]);
	});
});

describe('otherDomain', () => {
	it('mismo dominio con o sin www: no es otro', () => {
		expect(otherDomain('https://mipeluqueria.es/', 'https://www.mipeluqueria.es/inicio')).toBeNull();
	});

	it('si acaba en otro dominio, lo dice', () => {
		expect(otherDomain('https://mipeluqueria.es/', 'https://webs-baratas.com/plantilla')).toBe('webs-baratas.com');
	});
});
