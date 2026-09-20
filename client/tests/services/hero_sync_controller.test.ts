import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { MockEventSource } from '../setup';
import { HeroSyncController } from '../../src/services/hero_sync_controller';
import {
	LOCAL_STORAGE_CACHE_KEY,
	STATE_FATAL_NETWORK,
	STATE_FATAL_SERVER,
	STATE_FATAL_VALIDATION,
	HEARTBEAT_TIMEOUT_SECONDS,
} from '../../src/constants';
import { Hero, DraftHero } from '@hero_manager/shared';
import { ReactiveControllerHost } from 'lit';

describe('HeroSyncController service', () => {
	let host: EventTarget & ReactiveControllerHost;
	let controller: HeroSyncController;

	beforeEach(() => {
		localStorage.clear();
		host = Object.assign(new EventTarget(), {
			addController: vi.fn(),
			removeController: vi.fn(),
			requestUpdate: vi.fn(),
			updateComplete: Promise.resolve(true),
		});
		controller = new HeroSyncController(host);
	});

	afterEach(() => {
		controller.hostDisconnected();
		vi.useRealTimers();
	});

	it('fetches heroes on hostConnected and saves them to cache', async () => {
		controller.hostConnected();
		await new Promise((resolve) => setTimeout(resolve, 50));

		expect(controller.heroesMap.size).toBe(2);
		expect(controller.lastUpdated).toBe(1000);

		const cachedRaw = localStorage.getItem(LOCAL_STORAGE_CACHE_KEY);
		expect(cachedRaw).not.toBeNull();
		const cached = JSON.parse(cachedRaw!);
		expect(cached.heroes.length).toBe(2);
		expect(cached.heroes[0].name).toBe('Arthur Pendragon');
	});

	it('reconciles delta updates and purges heroes not in activeUuids', async () => {
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

		controller.hostConnected();
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Stale hero purged, only the 2 active server heroes remain
		expect(controller.heroesMap.has(staleHero.uuid)).toBe(false);
		expect(controller.heroesMap.size).toBe(2);
	});

	it('clears cache if localStorage has corrupted JSON', async () => {
		localStorage.setItem(LOCAL_STORAGE_CACHE_KEY, '{"corrupt_json":');

		controller.hostConnected();
		await new Promise((resolve) => setTimeout(resolve, 50));

		expect(controller.heroesMap.size).toBe(2);
		const cachedRaw = localStorage.getItem(LOCAL_STORAGE_CACHE_KEY);
		const cached = JSON.parse(cachedRaw!);
		expect(cached.heroes.length).toBe(2);
	});

	it('disconnects and notifies fatal-error if SSE heartbeat is lost', async () => {
		vi.useFakeTimers();

		const fatalSpy = vi.fn();
		host.addEventListener('fatal-error', fatalSpy as EventListener);

		controller.hostConnected();

		const sseInstance = MockEventSource.instances[0];
		expect(sseInstance).toBeDefined();

		sseInstance.emitOpen();
		vi.advanceTimersByTime((HEARTBEAT_TIMEOUT_SECONDS + 1) * 1000);

		expect(fatalSpy).toHaveBeenCalledTimes(1);
		const detail = (fatalSpy.mock.calls[0][0] as CustomEvent).detail;
		expect(detail).toBe(STATE_FATAL_NETWORK);
		expect(sseInstance.readyState).toBe(2); // CLOSED
	});

	it('notifies fatal-error when server returns 500 error', async () => {
		server.use(
			http.get('*/api/heroes', () => {
				return new HttpResponse(null, { status: 500 });
			})
		);

		const fatalSpy = vi.fn();
		host.addEventListener('fatal-error', fatalSpy as EventListener);

		controller.hostConnected();
		await new Promise((resolve) => setTimeout(resolve, 50));

		expect(fatalSpy).toHaveBeenCalledTimes(1);
		const detail = (fatalSpy.mock.calls[0][0] as CustomEvent).detail;
		expect(detail).toBe(STATE_FATAL_SERVER);
	});

	it('saveHero adds new hero to heroesMap and saves to cache', async () => {
		controller.hostConnected();
		await new Promise((resolve) => setTimeout(resolve, 50));

		const newHero: DraftHero = {
			name: 'Gawain',
			attack: 80,
			defense: 70,
			special_skill_id: 'sun_strength',
			status: 'active',
		};

		await controller.saveHero(newHero);

		expect(controller.heroesMap.size).toBe(3);
		const gawain = Array.from(controller.heroesMap.values()).find((h) => h.name === 'Gawain');
		expect(gawain).toBeDefined();
		expect(gawain?.uuid).toBe('33333333-3333-3333-3333-333333333333');

		const cached = JSON.parse(localStorage.getItem(LOCAL_STORAGE_CACHE_KEY)!);
		expect(cached.heroes.length).toBe(3);
	});

	it('saveHero notifies fatal-error when save fails with 422', async () => {
		server.use(
			http.post('*/api/heroes', () => {
				return new HttpResponse(null, { status: 422 });
			})
		);

		const fatalSpy = vi.fn();
		host.addEventListener('fatal-error', fatalSpy as EventListener);

		controller.hostConnected();
		await new Promise((resolve) => setTimeout(resolve, 50));

		const invalidHero: DraftHero = {
			name: '',
			attack: 0,
			defense: 0,
			special_skill_id: '',
			status: 'active',
		};

		await controller.saveHero(invalidHero);

		expect(fatalSpy).toHaveBeenCalledTimes(1);
		const detail = (fatalSpy.mock.calls[0][0] as CustomEvent).detail;
		expect(detail).toBe(STATE_FATAL_VALIDATION);
	});

	it('triggers silent fetchHeroes when SSE receives update message', async () => {
		controller.hostConnected();
		await new Promise((resolve) => setTimeout(resolve, 50));

		const fetchSpy = vi.spyOn(controller, 'fetchHeroes');

		const sseInstance = MockEventSource.instances[0];
		expect(sseInstance).toBeDefined();

		// Simulate server broadcasting 'update' via SSE
		sseInstance.emitMessage('update');

		expect(fetchSpy).toHaveBeenCalledWith(true);
	});

	it('notifies fatal-error when SSE connection errors and is closed', async () => {
		const fatalSpy = vi.fn();
		host.addEventListener('fatal-error', fatalSpy as EventListener);

		controller.hostConnected();
		await new Promise((resolve) => setTimeout(resolve, 50));

		const sseInstance = MockEventSource.instances[0];
		expect(sseInstance).toBeDefined();

		// Close connection then emit error
		sseInstance.close();
		sseInstance.emitError(new Error('Connection terminated'));

		expect(fatalSpy).toHaveBeenCalledTimes(1);
		const detail = (fatalSpy.mock.calls[0][0] as CustomEvent).detail;
		expect(detail).toBe(STATE_FATAL_NETWORK);
	});

	it('recovers and refetches when cache is empty but server has activeUuids', async () => {
		// Mock server returning activeUuids but no heroes for a non-zero timestamp
		server.use(
			http.get('*/api/heroes', ({ request }) => {
				const url = new URL(request.url);
				const lastUpdated = Number(url.searchParams.get('lastUpdated'));
				if (lastUpdated > 0) {
					return HttpResponse.json({
						lastUpdated: 2000,
						heroes: [],
						activeUuids: ['11111111-1111-1111-1111-111111111111'],
					});
				}
				// Default handler responds for lastUpdated = 0
				return HttpResponse.json({
					lastUpdated: 2000,
					heroes: [
						{
							uuid: '11111111-1111-1111-1111-111111111111',
							name: 'Recovered Hero',
							attack: 50,
							defense: 50,
							special_skill_id: 'slash',
							status: 'active',
						},
					],
					activeUuids: ['11111111-1111-1111-1111-111111111111'],
				});
			})
		);

		// Seed cache with lastUpdated > 0 but empty heroes array
		localStorage.setItem(
			LOCAL_STORAGE_CACHE_KEY,
			JSON.stringify({
				lastUpdated: 500,
				heroes: [],
			})
		);

		controller.hostConnected();
		await new Promise((resolve) => setTimeout(resolve, 80));

		// Should have automatically recovered by clearing cache and re-fetching
		expect(controller.heroesMap.size).toBe(1);
		expect(controller.heroesMap.get('11111111-1111-1111-1111-111111111111')?.name).toBe('Recovered Hero');
	});
});
