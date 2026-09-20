import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { HeroApiClient, HeroApiError } from '../../src/services/hero_api';
import {
	STATE_AUTH_EXPIRED,
	STATE_FATAL_NETWORK,
	STATE_FATAL_SERVER,
	STATE_FATAL_CLIENT,
	STATE_FATAL_VALIDATION
} from '../../src/constants';
import { Hero, DraftHero } from '@hero_manager/shared';

describe('HeroApiClient service', () => {
	const api = new HeroApiClient();

	const validDraft: DraftHero = {
		name: 'Bors',
		attack: 45,
		defense: 55,
		special_skill_id: 'mace_strike',
		status: 'active',
	};

	const validHero: Hero = {
		uuid: '11111111-1111-1111-1111-111111111111',
		name: 'Arthur Updated',
		attack: 85,
		defense: 65,
		special_skill_id: 'excalibur',
		status: 'active',
	};

	it('fetchHeroes returns typed sync response on success', async () => {
		const result = await api.fetchHeroes(0);
		expect(result.heroes.length).toBe(2);
		expect(result.lastUpdated).toBe(1000);
		expect(result.activeUuids.length).toBe(2);
	});

	it('fetchHeroes throws HeroApiError with STATE_FATAL_NETWORK on connection drop', async () => {
		server.use(
			http.get('*/api/heroes', () => {
				return HttpResponse.error();
			})
		);

		try {
			await api.fetchHeroes(0);
		} catch (err) {
			expect((err as HeroApiError).errorCode).toBe(STATE_FATAL_NETWORK);
		}
	});

	it('fetchHeroes throws HeroApiError with STATE_AUTH_EXPIRED on 401', async () => {
		server.use(
			http.get('*/api/heroes', () => {
				return new HttpResponse(null, { status: 401 });
			})
		);

		try {
			await api.fetchHeroes(0);
		} catch (err) {
			expect((err as HeroApiError).errorCode).toBe(STATE_AUTH_EXPIRED);
		}
	});

	it('fetchHeroes throws HeroApiError with STATE_FATAL_SERVER on 500', async () => {
		server.use(
			http.get('*/api/heroes', () => {
				return new HttpResponse(null, { status: 500 });
			})
		);

		try {
			await api.fetchHeroes(0);
		} catch (err) {
			expect((err as HeroApiError).errorCode).toBe(STATE_FATAL_SERVER);
		}
	});

	it('fetchHeroes throws HeroApiError with STATE_FATAL_CLIENT on 404', async () => {
		server.use(
			http.get('*/api/heroes', () => {
				return new HttpResponse(null, { status: 404 });
			})
		);

		try {
			await api.fetchHeroes(0);
		} catch (err) {
			expect((err as HeroApiError).errorCode).toBe(STATE_FATAL_CLIENT);
		}
	});

	it('fetchHeroes throws HeroApiError with STATE_FATAL_SERVER on unparseable JSON', async () => {
		server.use(
			http.get('*/api/heroes', () => {
				return new HttpResponse('Not JSON', {
					headers: { 'Content-Type': 'application/json' },
				});
			})
		);

		try {
			await api.fetchHeroes(0);
		} catch (err) {
			expect((err as HeroApiError).errorCode).toBe(STATE_FATAL_SERVER);
		}
	});

	it('fetchHeroes throws HeroApiError with STATE_FATAL_SERVER on schema mismatch', async () => {
		server.use(
			http.get('*/api/heroes', () => {
				return HttpResponse.json({ unexpected_payload: true });
			})
		);

		try {
			await api.fetchHeroes(0);
		} catch (err) {
			expect((err as HeroApiError).errorCode).toBe(STATE_FATAL_SERVER);
		}
	});

	it('saveHero issues POST for DraftHero and returns created hero with uuid', async () => {
		const created = await api.saveHero(validDraft);
		expect(created.uuid).toBe('33333333-3333-3333-3333-333333333333');
		expect(created.name).toBe('Bors');
	});

	it('saveHero issues PUT for existing Hero and returns updated hero', async () => {
		const updated = await api.saveHero(validHero);
		expect(updated.uuid).toBe(validHero.uuid);
		expect(updated.name).toBe('Arthur Updated');
	});

	it('saveHero throws HeroApiError with STATE_FATAL_NETWORK on connection drop', async () => {
		server.use(
			http.post('*/api/heroes', () => {
				return HttpResponse.error();
			})
		);

		try {
			await api.saveHero(validDraft);
		} catch (err) {
			expect((err as HeroApiError).errorCode).toBe(STATE_FATAL_NETWORK);
		}
	});

	it('saveHero throws HeroApiError with STATE_AUTH_EXPIRED on 401', async () => {
		server.use(
			http.post('*/api/heroes', () => {
				return new HttpResponse(null, { status: 401 });
			})
		);

		try {
			await api.saveHero(validDraft);
		} catch (err) {
			expect((err as HeroApiError).errorCode).toBe(STATE_AUTH_EXPIRED);
		}
	});

	it('saveHero throws HeroApiError with STATE_FATAL_VALIDATION on 422', async () => {
		server.use(
			http.post('*/api/heroes', () => {
				return new HttpResponse(null, { status: 422 });
			})
		);

		try {
			await api.saveHero(validDraft);
		} catch (err) {
			expect((err as HeroApiError).errorCode).toBe(STATE_FATAL_VALIDATION);
		}
	});

	it('saveHero throws HeroApiError with STATE_FATAL_SERVER on 500', async () => {
		server.use(
			http.post('*/api/heroes', () => {
				return new HttpResponse(null, { status: 500 });
			})
		);

		try {
			await api.saveHero(validDraft);
		} catch (err) {
			expect((err as HeroApiError).errorCode).toBe(STATE_FATAL_SERVER);
		}
	});

	it('saveHero throws HeroApiError with STATE_FATAL_CLIENT on 400', async () => {
		server.use(
			http.post('*/api/heroes', () => {
				return new HttpResponse(null, { status: 400 });
			})
		);

		try {
			await api.saveHero(validDraft);
		} catch (err) {
			expect((err as HeroApiError).errorCode).toBe(STATE_FATAL_CLIENT);
		}
	});

	it('saveHero throws HeroApiError with STATE_FATAL_SERVER on invalid JSON response', async () => {
		server.use(
			http.post('*/api/heroes', () => {
				return new HttpResponse('Not JSON', {
					headers: { 'Content-Type': 'application/json' },
				});
			})
		);

		try {
			await api.saveHero(validDraft);
		} catch (err) {
			expect((err as HeroApiError).errorCode).toBe(STATE_FATAL_SERVER);
		}
	});

	it('saveHero throws HeroApiError with STATE_FATAL_SERVER on schema mismatch response', async () => {
		server.use(
			http.post('*/api/heroes', () => {
				return HttpResponse.json({ bad_hero: true });
			})
		);

		try {
			await api.saveHero(validDraft);
		} catch (err) {
			expect((err as HeroApiError).errorCode).toBe(STATE_FATAL_SERVER);
		}
	});
});
