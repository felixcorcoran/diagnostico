import { afterEach, describe, expect, it, vi } from 'vitest';
import { clientIp, limiter, memo, siteKey } from '../src/lib/limit';

afterEach(() => vi.useRealTimers());

describe('limiter: un máximo de peticiones por IP cada 10 minutos', () => {
	it('deja pasar hasta el máximo y frena la siguiente', () => {
		const limitado = limiter(3);
		expect([limitado('1.1.1.1'), limitado('1.1.1.1'), limitado('1.1.1.1')]).toEqual([false, false, false]);
		expect(limitado('1.1.1.1')).toBe(true);
	});

	it('cada IP lleva su cuenta', () => {
		const limitado = limiter(1);
		limitado('1.1.1.1');
		expect(limitado('2.2.2.2')).toBe(false);
	});

	it('pasados los 10 minutos, vuelve a dejar pasar', () => {
		vi.useFakeTimers();
		const limitado = limiter(1);
		limitado('1.1.1.1');
		expect(limitado('1.1.1.1')).toBe(true);
		vi.advanceTimersByTime(10 * 60_000 + 1);
		expect(limitado('1.1.1.1')).toBe(false);
	});
});

describe('memo: caché de 10 minutos', () => {
	it('devuelve lo guardado y lo olvida al caducar', () => {
		vi.useFakeTimers();
		const cache = memo<string>();
		cache.set('web', 'resultado');
		expect(cache.get('web')).toBe('resultado');
		vi.advanceTimersByTime(10 * 60_000 + 1);
		expect(cache.get('web')).toBeUndefined();
	});
});

describe('siteKey: la misma web, escrita de varias formas, es la misma clave', () => {
	it('sin protocolo, www ni barra final', () => {
		const clave = siteKey(new URL('https://www.MiPeluqueria.es/'));
		expect(clave).toBe('mipeluqueria.es');
		expect(siteKey(new URL('http://mipeluqueria.es'))).toBe(clave);
	});
});

describe('clientIp', () => {
	it('toma la primera IP de x-forwarded-for (la de Vercel)', () => {
		const req = new Request('https://x.es', { headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' } });
		expect(clientIp(req, undefined)).toBe('203.0.113.7');
	});
});
