import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { MockEventSource } from '../setup';
import { HeroManager } from '../../src/components/hero_manager';
import {
	LOCAL_STORAGE_CACHE_KEY,
	STATE_FATAL_NETWORK,
	HEARTBEAT_TIMEOUT_SECONDS,
	STATE_FATAL_SERVER,
} from '../../src/constants';
import { Hero } from '../../src/interfaces';

describe('HeroManager sync and cache logic', () => {
	let manager: HeroManager;

	beforeEach(() => {
		localStorage.clear();
		HeroManager.register();
		manager = document.createElement('hero-manager') as HeroManager;
	});

	afterEach(() => {
		manager.remove();
		vi.useRealTimers();
	});

	it('fetches heroes on mount and saves them to localStorage cache', async () => {
		document.body.appendChild(manager);

		// Allow fetchHeroes async promise chain to complete
		await new Promise((resolve) => setTimeout(resolve, 50));

		const cachedRaw = localStorage.getItem(LOCAL_STORAGE_CACHE_KEY);
		expect(cachedRaw).not.toBeNull();

		const cached = JSON.parse(cachedRaw!);
		expect(cached.heroes.length).toBe(2);
		expect(cached.heroes[0].name).toBe('Arthur Pendragon');
		expect(cached.lastUpdated).toBe(1000);
	});

	it('reconciles delta updates and removes deleted heroes not in activeUuids', async () => {
		// 1. Pre-seed cache with an older hero that will be removed on next sync
		const staleHero: Hero = {
			uuid: '99999999-9999-9999-9999-999999999999',
			name: 'Stale Hero',
			attack: 10,
			defense: 10,
			special_skill_id: 'old_skill',
			status: 'active',
		};

		localStorage.setItem(
			LOCAL_STORAGE_CACHE_KEY,
			JSON.stringify({
				lastUpdated: 500,
				heroes: [staleHero],
			})
		);

		// 2. Mount component to trigger delta sync with MSW handlers
		document.body.appendChild(manager);
		await new Promise((resolve) => setTimeout(resolve, 50));

		// 3. Stale hero should be purged because it is not in MSW activeUuids
		const cachedRaw = localStorage.getItem(LOCAL_STORAGE_CACHE_KEY);
		const cached = JSON.parse(cachedRaw!);
		const staleFound = cached.heroes.find((h: Hero) => h.uuid === staleHero.uuid);
		expect(staleFound).toBeUndefined();
		expect(cached.heroes.length).toBe(2);
	});

	it('clears cache if localStorage has corrupted/schema-invalid JSON', async () => {
		// Pre-seed corrupted cache data
		localStorage.setItem(LOCAL_STORAGE_CACHE_KEY, '{"invalid_json": true');

		document.body.appendChild(manager);
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Valid data fetched from MSW should replace the corrupted cache
		const cachedRaw = localStorage.getItem(LOCAL_STORAGE_CACHE_KEY);
		const cached = JSON.parse(cachedRaw!);
		expect(cached.heroes.length).toBe(2);
	});

	it('disconnects and fires fatal-error if SSE heartbeat is lost', async () => {
		vi.useFakeTimers();

		const fatalSpy = vi.fn();
		manager.addEventListener('fatal-error', fatalSpy);

		document.body.appendChild(manager);

		const sseInstance = MockEventSource.instances[0];
		expect(sseInstance).toBeDefined();

		// Trigger open event to start ping watchdog timer
		sseInstance.emitOpen();

		// Fast-forward time past HEARTBEAT_TIMEOUT_SECONDS (10s)
		vi.advanceTimersByTime((HEARTBEAT_TIMEOUT_SECONDS + 1) * 1000);

		expect(fatalSpy).toHaveBeenCalledTimes(1);
		expect(fatalSpy.mock.calls[0][0].detail).toBe(STATE_FATAL_NETWORK);
		expect(sseInstance.readyState).toBe(2); // 2 = CLOSED
	});

	it('dispatches fatal-error when server returns 500 error', async () => {
		// Temporarily override /api/heroes to return 500 for this test only
		server.use(
			http.get('*/api/heroes', () => {
				return new HttpResponse(null, { status: 500 });
			})
		);

		const fatalSpy = vi.fn();
		manager.addEventListener('fatal-error', fatalSpy);

		document.body.appendChild(manager);
		await new Promise((resolve) => setTimeout(resolve, 50));

		expect(fatalSpy).toHaveBeenCalledTimes(1);
		expect(fatalSpy.mock.calls[0][0].detail).toBe(STATE_FATAL_SERVER);
	});
});