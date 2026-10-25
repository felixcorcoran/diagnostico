/**
 * La protección SSRF: el diagnóstico pide la web que escribe cualquiera, así
 * que no puede servir para llegar a la red interna del servidor.
 */
import { describe, expect, it } from 'vitest';
import { isAllowedUrl, isPublicAddress } from '../src/lib/http';

describe('isPublicAddress', () => {
	it.each(['8.8.8.8', '1.1.1.1', '93.184.216.34', '2606:4700:4700::1111'])('%s es pública', (ip) => {
		expect(isPublicAddress(ip)).toBe(true);
	});

	it.each([
		['127.0.0.1', 'bucle local'],
		['10.0.0.5', 'red privada'],
		['172.16.4.1', 'red privada'],
		['192.168.1.1', 'red privada'],
		['169.254.169.254', 'metadatos de la nube'],
		['100.64.0.1', 'CGNAT'],
		['0.0.0.0', 'sin dirección'],
		['::1', 'bucle local IPv6'],
		['fc00::1', 'privada IPv6'],
		['fe80::1', 'enlace local IPv6'],
	])('%s no es pública (%s)', (ip) => {
		expect(isPublicAddress(ip)).toBe(false);
	});

	it('una IPv4 privada disfrazada de IPv6 tampoco pasa', () => {
		expect(isPublicAddress('::ffff:127.0.0.1')).toBe(false);
		expect(isPublicAddress('::ffff:10.0.0.1')).toBe(false);
		expect(isPublicAddress('::ffff:8.8.8.8')).toBe(true);
	});

	it('lo que no es una IP no es pública', () => {
		expect(isPublicAddress('localhost')).toBe(false);
		expect(isPublicAddress('')).toBe(false);
	});
});

describe('isAllowedUrl', () => {
	const ok = (u: string) => isAllowedUrl(new URL(u));

	it('webs normales, por http o https', () => {
		expect(ok('https://mipeluqueria.es/')).toBe(true);
		expect(ok('http://www.ejemplo.com/contacto')).toBe(true);
		expect(ok('https://ejemplo.com:443/')).toBe(true);
	});

	it('otros protocolos, no', () => {
		expect(ok('file:///etc/passwd')).toBe(false);
		expect(ok('ftp://ejemplo.com/')).toBe(false);
		expect(ok('gopher://ejemplo.com/')).toBe(false);
	});

	it('puertos que no son los de la web, no', () => {
		expect(ok('https://ejemplo.com:8080/')).toBe(false);
		expect(ok('http://ejemplo.com:22/')).toBe(false);
	});

	it('con usuario o contraseña en la dirección, no', () => {
		expect(ok('https://usuario:clave@ejemplo.com/')).toBe(false);
	});

	it('IPs privadas escritas tal cual, no; una pública, sí', () => {
		expect(ok('http://127.0.0.1/')).toBe(false);
		expect(ok('http://169.254.169.254/latest/meta-data/')).toBe(false);
		expect(ok('http://[::1]/')).toBe(false);
		expect(ok('http://8.8.8.8/')).toBe(true);
	});

	it('nombres internos, no', () => {
		expect(ok('http://localhost/')).toBe(false);
		expect(ok('http://impresora.local/')).toBe(false);
		expect(ok('http://servicio.internal/')).toBe(false);
	});
});
