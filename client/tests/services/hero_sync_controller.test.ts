import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { MockEventSource } from '../setup';
import { HeroSyncController } from '../../src/services/hero_sync_controller';
import {
	LOCAL_STORAGE_CACHE_KEY,
	STATE_FATAL_NETWORK,
	STATE_FATAL_SERVER,
	HEARTBEAT_TIMEOUT_SECONDS,
} from '../../src/constants';
import { Hero } from '@hero_manager/shared';
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
});
