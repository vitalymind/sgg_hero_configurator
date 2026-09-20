import { LitElement, html, css } from 'lit';
import { state, query } from 'lit/decorators.js';
import { Hero, LocalStorageCache } from '../interfaces';
import {
	LOCAL_STORAGE_CACHE_KEY,
	STATE_FATAL_NETWORK,
	STATE_FATAL_SERVER,
	STATE_FATAL_CLIENT,
	STATE_AUTH_EXPIRED,
	STATE_SYNCING_DATA,
	STATE_FATAL_VALIDATION,
	HEARTBEAT_TIMEOUT_SECONDS,
	API_BASE_URL,
	LocalStorageCacheSchema,
	HeroesSyncResponseSchema,
	HeroSchema
} from '../constants';
import { HeroList } from './hero_list';
import { HeroFormDialog } from './hero_form_dialog';
import { StatusScreenCover } from './status_screen_cover';

export class HeroManager extends LitElement {
	static register() {
		HeroList.register();
		HeroFormDialog.register();
		StatusScreenCover.register();
		if (!customElements.get('hero-manager')) {
			customElements.define('hero-manager', HeroManager);
		}
	}

	@state() private heroesMap = new Map<string, Hero>();
	@state() private lastUpdated = 0;
	@state() private filterQuery = '';
	@state() private isSyncing = false;

	@state() private isDialogOpen = false;
	@state() private currentEditHero: Hero | null = null;
	private eventSource: EventSource | null = null;
	private pingTimeout: ReturnType<typeof setTimeout> | null = null;

	@query('hero-list') heroList?: HeroList;
	@query('hero-form-dialog') formDialog?: HeroFormDialog;

	clean() {
		this.filterQuery = '';
		this.isSyncing = false;
		this.isDialogOpen = false;
		this.currentEditHero = null;
		if (this.heroList) {
			this.heroList.clean();
		}
		if (this.formDialog) {
			this.formDialog.clean();
		}
	}

	static styles = css`
		:host {
			display: block;
			max-width: 1200px;
			margin: 0 auto;
			padding: 20px;
		}
	`;

	connectedCallback() {
		super.connectedCallback();
		this.loadFromCache();
		this.fetchHeroes(false);
		this.initEventSource();
	}

	disconnectedCallback() {
		super.disconnectedCallback();
		if (this.eventSource) {
			this.eventSource.close();
		}
		if (this.pingTimeout) {
			clearTimeout(this.pingTimeout);
		}
	}

	private resetPingTimeout() {
		if (this.pingTimeout) {
			clearTimeout(this.pingTimeout);
		}
		this.pingTimeout = setTimeout(() => {
			console.warn("SSE Heartbeat lost. Disconnecting...");
			if (this.eventSource) {
				this.eventSource.close();
			}
			this.dispatchEvent(new CustomEvent('fatal-error', { detail: STATE_FATAL_NETWORK }));
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
			console.error("EventSource failed", e);
			if (this.eventSource && this.eventSource.readyState === EventSource.CLOSED) {
				this.dispatchEvent(new CustomEvent('fatal-error', { detail: STATE_FATAL_NETWORK }));
			} else {
				this.fetchHeroes(true);
			}
		};
	}

	private loadFromCache() {
		const cached = localStorage.getItem(LOCAL_STORAGE_CACHE_KEY);
		if (cached) {
			try {
				const raw = JSON.parse(cached);
				const parseResult = LocalStorageCacheSchema.safeParse(raw);
				if (parseResult.success) {
					this.lastUpdated = parseResult.data.lastUpdated;
					this.heroesMap.clear();
					for (const hero of parseResult.data.heroes) {
						if (hero.uuid) {
							this.heroesMap.set(hero.uuid, hero);
						}
					}
					this.requestUpdate();
				} else {
					console.warn("Cached data failed schema validation, resetting cache:", parseResult.error);
					this.clearCache();
				}
			} catch (e) {
				console.error("Failed to parse cache", e);
				this.clearCache();
			}
		}
	}

	private clearCache() {
		this.lastUpdated = 0;
		this.heroesMap.clear();
		try {
			localStorage.removeItem(LOCAL_STORAGE_CACHE_KEY);
		} catch (e) {
			console.warn("Failed to clear cache from localStorage", e);
		}
	}

	private saveToCache() {
		try {
			const data: LocalStorageCache = {
				lastUpdated: this.lastUpdated,
				heroes: Array.from(this.heroesMap.values())
			};
			localStorage.setItem(LOCAL_STORAGE_CACHE_KEY, JSON.stringify(data));
			this.requestUpdate();
		} catch (e) {
			console.error("Failed to save to cache", e);
			this.dispatchEvent(new CustomEvent('fatal-error', { detail: STATE_FATAL_CLIENT }));
		}
	}

	private async fetchHeroesClearCache(silent: boolean = false) {
		this.clearCache();
		await this.fetchHeroes(silent);
	}

	private async fetchHeroes(silent: boolean = false) {
		if (!silent) {
			this.isSyncing = true;
		}

		const requestedTimestamp = this.lastUpdated;
		let response: Response;
		try {
			response = await fetch(`${API_BASE_URL}/api/heroes?lastUpdated=${requestedTimestamp}`, { credentials: 'include' });
		} catch (networkError) {
			console.error("Network error fetching heroes:", networkError);
			this.dispatchEvent(new CustomEvent('fatal-error', { detail: STATE_FATAL_NETWORK }));
			if (!silent) {
				this.isSyncing = false;
			}
			return;
		}

		try {
			if (response.ok) {
				let rawData: unknown;
				try {
					rawData = await response.json();
				} catch (parseError) {
					console.error("JSON parsing error on heroes response:", parseError);
					this.dispatchEvent(new CustomEvent('fatal-error', { detail: STATE_FATAL_SERVER }));
					return;
				}

				const parseResult = HeroesSyncResponseSchema.safeParse(rawData);
				if (!parseResult.success) {
					console.error("Heroes sync response failed schema validation:", parseResult.error);
					this.dispatchEvent(new CustomEvent('fatal-error', { detail: STATE_FATAL_SERVER }));
					return;
				}

				const data = parseResult.data;
				this.lastUpdated = data.lastUpdated;
				for (const hero of data.heroes) {
					if (hero.uuid) {
						this.heroesMap.set(hero.uuid, hero);
					}
				}

				const validServerUuids = new Set(data.activeUuids);
				for (const localUuid of this.heroesMap.keys()) {
					if (!validServerUuids.has(localUuid)) {
						this.heroesMap.delete(localUuid);
					}
				}

				if (this.heroesMap.size === 0 && data.activeUuids.length > 0) {
					if (requestedTimestamp > 0) {
						this.fetchHeroesClearCache(silent);
						return;
					} else {
						console.error("Server returned active UUIDs but no hero records for lastUpdated=0");
						this.dispatchEvent(new CustomEvent('fatal-error', { detail: STATE_FATAL_SERVER }));
						return;
					}
				}

				this.saveToCache();
			} else {
				if (response.status === 401) {
					this.dispatchEvent(new CustomEvent('fatal-error', { detail: STATE_AUTH_EXPIRED }));
				} else if (response.status >= 500) {
					this.dispatchEvent(new CustomEvent('fatal-error', { detail: STATE_FATAL_SERVER }));
				} else {
					this.dispatchEvent(new CustomEvent('fatal-error', { detail: STATE_FATAL_CLIENT }));
				}
			}
		} catch (e) {
			console.error("Unexpected error processing heroes data:", e);
			this.dispatchEvent(new CustomEvent('fatal-error', { detail: STATE_FATAL_CLIENT }));
		} finally {
			if (!silent) {
				this.isSyncing = false;
			}
		}
	}

	private handleFilterChanged(e: CustomEvent) {
		this.filterQuery = e.detail;
	}

	private handleCreateHero() {
		this.currentEditHero = null;
		this.isDialogOpen = true;
	}

	private handleEditHero(e: CustomEvent) {
		this.currentEditHero = e.detail;
		this.isDialogOpen = true;
	}

	private async handleDeleteHero(e: CustomEvent) {
		const hero = e.detail as Hero;
		if (hero.uuid) {
			await this.saveHeroDataToServer({ ...hero, status: 'deleted' });
		}
	}

	private handleCloseDialog() {
		this.isDialogOpen = false;
		this.currentEditHero = null;
	}

	private async handleSaveHero(e: CustomEvent) {
		const heroData = e.detail as Hero;
		this.isDialogOpen = false;
		await this.saveHeroDataToServer(heroData);
	}

	private async saveHeroDataToServer(heroData: Hero) {
		this.isSyncing = true;
		const method = heroData.uuid !== null ? 'PUT' : 'POST';
		const url = heroData.uuid !== null ? `${API_BASE_URL}/api/heroes/${heroData.uuid}` : `${API_BASE_URL}/api/heroes`;

		let res: Response;
		try {
			res = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify(heroData)
			});
		} catch (networkError) {
			console.error("Network error saving hero data:", networkError);
			this.dispatchEvent(new CustomEvent('fatal-error', { detail: STATE_FATAL_NETWORK }));
			this.isSyncing = false;
			return;
		}

		try {
			if (res.ok) {
				let rawData: unknown;
				try {
					rawData = await res.json();
				} catch (parseError) {
					console.error("JSON parsing error on save hero response:", parseError);
					this.dispatchEvent(new CustomEvent('fatal-error', { detail: STATE_FATAL_SERVER }));
					return;
				}

				const parseResult = HeroSchema.safeParse(rawData);
				if (!parseResult.success) {
					console.error("Save hero response failed schema validation:", parseResult.error);
					this.dispatchEvent(new CustomEvent('fatal-error', { detail: STATE_FATAL_SERVER }));
					return;
				}

				const updatedHero = parseResult.data;
				if (updatedHero && updatedHero.uuid) {
					this.heroesMap.set(updatedHero.uuid, updatedHero);
				}
				this.saveToCache();
			} else {
				if (res.status === 401) {
					this.dispatchEvent(new CustomEvent('fatal-error', { detail: STATE_AUTH_EXPIRED }));
				} else if (res.status === 422) {
					this.dispatchEvent(new CustomEvent('fatal-error', { detail: STATE_FATAL_VALIDATION }));
				} else if (res.status >= 500) {
					this.dispatchEvent(new CustomEvent('fatal-error', { detail: STATE_FATAL_SERVER }));
				} else {
					this.dispatchEvent(new CustomEvent('fatal-error', { detail: STATE_FATAL_CLIENT }));
				}
			}
		} catch (e) {
			console.error("Unexpected error saving hero data:", e);
			this.dispatchEvent(new CustomEvent('fatal-error', { detail: STATE_FATAL_CLIENT }));
		} finally {
			this.isSyncing = false;
		}
	}

	render() {
		const visibleHeroes = Array.from(this.heroesMap.values())
			.filter(h => h.status !== 'deleted')
			.filter(h => h.name.toLocaleLowerCase().includes(this.filterQuery.toLocaleLowerCase()));

		return html`
			<hero-list 
				.heroes="${visibleHeroes}"
				.filterQuery="${this.filterQuery}"
				@filter-changed="${this.handleFilterChanged}"
				@refresh-heroes="${() => this.fetchHeroes(false)}"
				@refresh-heroes-cache="${() => this.fetchHeroesClearCache(false)}"
				@create-hero="${this.handleCreateHero}"
				@edit-hero="${this.handleEditHero}"
			></hero-list>

			<hero-form-dialog
				.isOpen="${this.isDialogOpen}"
				.editingHero="${this.currentEditHero}"
				@close-dialog="${this.handleCloseDialog}"
				@save-hero="${this.handleSaveHero}"
				@delete-hero="${this.handleDeleteHero}"
			></hero-form-dialog>

			${this.isSyncing ? html`<status-screen-cover .loadingState=${STATE_SYNCING_DATA}></status-screen-cover>` : ''}
		`;
	}
}
