import { ReactiveController, ReactiveControllerHost } from 'lit';
import { HeroCache, heroCache } from './hero_cache';
import { HeroApiClient, heroApiClient, HeroApiError } from './hero_api';
import {
	STATE_FATAL_NETWORK,
	STATE_FATAL_SERVER,
	STATE_FATAL_CLIENT,
	HEARTBEAT_TIMEOUT_SECONDS,
	API_BASE_URL
} from '../constants';
import { DraftHero, Hero } from '@hero_manager/shared';

export class HeroSyncController implements ReactiveController {
	private host: ReactiveControllerHost & EventTarget;
	private cache: HeroCache;
	private api: HeroApiClient;

	heroesMap = new Map<string, Hero>();
	lastUpdated = 0;
	isSyncing = false;

	private eventSource: EventSource | null = null;
	private pingTimeout: ReturnType<typeof setTimeout> | null = null;

	constructor(
		host: ReactiveControllerHost & EventTarget,
		cache: HeroCache = heroCache,
		api: HeroApiClient = heroApiClient
	) {
		this.host = host;
		this.cache = cache;
		this.api = api;
		this.host.addController(this);
	}

	hostConnected() {
		this.loadFromCache();
		this.fetchHeroes(false);
		this.initEventSource();
	}

	hostDisconnected() {
		if (this.eventSource) {
			this.eventSource.close();
			this.eventSource = null;
		}
		if (this.pingTimeout) {
			clearTimeout(this.pingTimeout);
			this.pingTimeout = null;
		}
	}

	private resetPingTimeout() {
		if (this.pingTimeout) {
			clearTimeout(this.pingTimeout);
		}
		this.pingTimeout = setTimeout(() => {
			console.warn('SSE Heartbeat lost. Disconnecting...');
			if (this.eventSource) {
				this.eventSource.close();
				this.eventSource = null;
			}
			this.notifyFatalError(STATE_FATAL_NETWORK);
		}, HEARTBEAT_TIMEOUT_SECONDS * 1000);
	}

	private initEventSource() {
		if (this.eventSource) {
			this.eventSource.close();
		}
		this.eventSource = new EventSource(`${API_BASE_URL}/api/heroes/stream`);

		this.eventSource.onmessage = (e) => {
			this.resetPingTimeout();
			if (e.data === 'update') {
				this.fetchHeroes(true);
			}
		};
		this.eventSource.onopen = () => {
			this.resetPingTimeout();
			this.fetchHeroes(true);
		};
		this.eventSource.onerror = (e) => {
			console.error('EventSource failed', e);
			if (this.eventSource && this.eventSource.readyState === EventSource.CLOSED) {
				this.notifyFatalError(STATE_FATAL_NETWORK);
			} else {
				this.fetchHeroes(true);
			}
		};
	}

	private notifyFatalError(errorCode: number) {
		this.host.dispatchEvent(new CustomEvent('fatal-error', { detail: errorCode }));
	}

	loadFromCache() {
		const cached = this.cache.load();
		if (cached) {
			this.lastUpdated = cached.lastUpdated;
			this.heroesMap.clear();
			for (const hero of cached.heroes) {
				this.heroesMap.set(hero.uuid, hero);
			}
			this.host.requestUpdate();
		}
	}

	clearCache() {
		this.lastUpdated = 0;
		this.heroesMap.clear();
		this.cache.clear();
		this.host.requestUpdate();
	}

	private saveToCache() {
		try {
			this.cache.save(this.lastUpdated, Array.from(this.heroesMap.values()));
			this.host.requestUpdate();
		} catch (e) {
			console.error('Failed to save to cache', e);
			this.notifyFatalError(STATE_FATAL_CLIENT);
		}
	}

	async fetchHeroesClearCache(silent: boolean = false) {
		this.clearCache();
		await this.fetchHeroes(silent);
	}

	async fetchHeroes(silent: boolean = false) {
		if (!silent) {
			this.isSyncing = true;
			this.host.requestUpdate();
		}

		const requestedTimestamp = this.lastUpdated;

		try {
			const data = await this.api.fetchHeroes(requestedTimestamp);
			this.lastUpdated = data.lastUpdated;
			for (const hero of data.heroes) {
				this.heroesMap.set(hero.uuid, hero);
			}

			const validServerUuids = new Set(data.activeUuids);
			for (const localUuid of this.heroesMap.keys()) {
				if (!validServerUuids.has(localUuid)) {
					this.heroesMap.delete(localUuid);
				}
			}

			if (this.heroesMap.size === 0 && data.activeUuids.length > 0) {
				if (requestedTimestamp > 0) {
					await this.fetchHeroesClearCache(silent);
					return;
				} else {
					console.error('Server returned active UUIDs but no hero records for lastUpdated=0');
					this.notifyFatalError(STATE_FATAL_SERVER);
					return;
				}
			}

			this.saveToCache();
		} catch (e) {
			if (e instanceof HeroApiError) {
				this.notifyFatalError(e.errorCode);
			} else {
				console.error('Unexpected error processing heroes data:', e);
				this.notifyFatalError(STATE_FATAL_CLIENT);
			}
		} finally {
			if (!silent) {
				this.isSyncing = false;
				this.host.requestUpdate();
			}
		}
	}

	async saveHero(heroData: Hero | DraftHero) {
		this.isSyncing = true;
		this.host.requestUpdate();

		try {
			const updatedHero = await this.api.saveHero(heroData);
			this.heroesMap.set(updatedHero.uuid, updatedHero);
			this.saveToCache();
		} catch (e) {
			if (e instanceof HeroApiError) {
				this.notifyFatalError(e.errorCode);
			} else {
				console.error('Unexpected error saving hero data:', e);
				this.notifyFatalError(STATE_FATAL_CLIENT);
			}
		} finally {
			this.isSyncing = false;
			this.host.requestUpdate();
		}
	}
}
