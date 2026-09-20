import { describe, it, expect, beforeEach } from 'vitest';
import { HeroCache } from '../../src/services/hero_cache';
import { Hero } from '@hero_manager/shared';

describe('HeroCache service', () => {
	const testKey = 'test_hero_cache';
	let cache: HeroCache;

	beforeEach(() => {
		localStorage.clear();
		cache = new HeroCache(testKey);
	});

	it('returns null when cache is empty', () => {
		expect(cache.load()).toBeNull();
	});

	it('saves and loads hero data correctly', () => {
		const sampleHeroes: Hero[] = [
			{
				uuid: '11111111-1111-1111-1111-111111111111',
				name: 'Galahad',
				attack: 50,
				defense: 50,
				special_skill_id: 'shield',
				status: 'active',
			},
		];

		cache.save(1234, sampleHeroes);
		const loaded = cache.load();

		expect(loaded).not.toBeNull();
		expect(loaded?.lastUpdated).toBe(1234);
		expect(loaded?.heroes.length).toBe(1);
		expect(loaded?.heroes[0].name).toBe('Galahad');
	});

	it('clears stored data', () => {
		cache.save(100, []);
		expect(cache.load()).not.toBeNull();

		cache.clear();
		expect(cache.load()).toBeNull();
	});

	it('returns null and purges cache on schema-invalid data', () => {
		localStorage.setItem(testKey, JSON.stringify({ invalid_property: 42 }));
		expect(cache.load()).toBeNull();
		// Should have wiped the corrupted key
		expect(localStorage.getItem(testKey)).toBeNull();
	});

	it('returns null and purges cache on corrupted JSON string', () => {
		localStorage.setItem(testKey, '{ broken json');
		expect(cache.load()).toBeNull();
		expect(localStorage.getItem(testKey)).toBeNull();
	});
});
