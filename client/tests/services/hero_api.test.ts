import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { HeroApiClient, HeroApiError } from '../../src/services/hero_api';
import {
	STATE_AUTH_EXPIRED,
	STATE_FATAL_SERVER,
	STATE_FATAL_VALIDATION
} from '../../src/constants';
import { Hero, DraftHero } from '@hero_manager/shared';

describe('HeroApiClient service', () => {
	const api = new HeroApiClient();

	it('fetchHeroes returns typed sync response on success', async () => {
		const result = await api.fetchHeroes(0);
		expect(result.heroes.length).toBe(2);
		expect(result.lastUpdated).toBe(1000);
		expect(result.activeUuids.length).toBe(2);
	});

	it('fetchHeroes throws HeroApiError with STATE_AUTH_EXPIRED on 401', async () => {
		server.use(
			http.get('*/api/heroes', () => {
				return new HttpResponse(null, { status: 401 });
			})
		);

		await expect(api.fetchHeroes(0)).rejects.toThrow(HeroApiError);
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

	it('saveHero issues POST for DraftHero and returns created hero with uuid', async () => {
		const newHero: DraftHero = {
			name: 'Bors',
			attack: 45,
			defense: 55,
			special_skill_id: 'mace_strike',
			status: 'active',
		};

		const created = await api.saveHero(newHero);
		expect(created.uuid).toBe('33333333-3333-3333-3333-333333333333');
		expect(created.name).toBe('Bors');
	});

	it('saveHero issues PUT for existing Hero and returns updated hero', async () => {
		const existingHero: Hero = {
			uuid: '11111111-1111-1111-1111-111111111111',
			name: 'Arthur Updated',
			attack: 85,
			defense: 65,
			special_skill_id: 'excalibur',
			status: 'active',
		};

		const updated = await api.saveHero(existingHero);
		expect(updated.uuid).toBe(existingHero.uuid);
		expect(updated.name).toBe('Arthur Updated');
	});

	it('saveHero throws HeroApiError with STATE_FATAL_VALIDATION on 422', async () => {
		server.use(
			http.post('*/api/heroes', () => {
				return new HttpResponse(null, { status: 422 });
			})
		);

		const invalidHero: DraftHero = {
			name: '',
			attack: 0,
			defense: 0,
			special_skill_id: '',
			status: 'active',
		};

		try {
			await api.saveHero(invalidHero);
		} catch (err) {
			expect((err as HeroApiError).errorCode).toBe(STATE_FATAL_VALIDATION);
		}
	});
});
