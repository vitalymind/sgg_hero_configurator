import { LitElement, html, css } from 'lit';
import { customElement, state, query } from 'lit/decorators.js';
import { Hero, LocalStorageCache, HeroesSyncResponse } from '../interfaces.ts';
import {
	LOCAL_STORAGE_CACHE_KEY,
	STATE_FATAL_NETWORK,
	STATE_FATAL_SERVER,
	STATE_FATAL_CLIENT,
	STATE_AUTH_EXPIRED,
	STATE_SYNCING_DATA,
	STATE_FATAL_VALIDATION,
	HEARTBEAT_TIMEOUT_SECONDS,
	API_BASE_URL
} from '../constants.ts';
import { modalBackdropStyle, modalContainerStyle } from '../common_styles.ts';
import './hero_list.ts';
import './hero_form_dialog.ts';

@customElement('hero-manager')
export class HeroManager extends LitElement {
	@state() private heroesMap = new Map<string, Hero>();
	@state() private lastUpdated = 0;
	@state() private filterQuery = '';
	@state() private isSyncing = false;

	@state() private isDialogOpen = false;
	@state() private currentEditHero: Hero | null = null;
	private eventSource: EventSource | null = null;
	private pingTimeout: any = null;

	@query('hero-list') heroList: any;
	@query('hero-form-dialog') formDialog: any;

	clean() {
		this.filterQuery = '';
		this.isSyncing = false;
		this.isDialogOpen = false;
		this.currentEditHero = null;
		if (this.heroList && typeof this.heroList.clean === 'function') this.heroList.clean();
		if (this.formDialog && typeof this.formDialog.clean === 'function') this.formDialog.clean();
	}

	static styles = [
		modalBackdropStyle,
		modalContainerStyle,
		css`
			:host {
				display: block;
				max-width: 1200px;
				margin: 0 auto;
				padding: 20px;
			}
			.loading-text {
				font-size: 1.5rem;
				font-weight: bold;
				text-align: center;
			}
			`
	];

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
			this.fetchHeroes(true);
		};
	}

	private loadFromCache() {
		const cached = localStorage.getItem(LOCAL_STORAGE_CACHE_KEY);
		if (cached) {
			try {
				const data = JSON.parse(cached) as LocalStorageCache;
				this.lastUpdated = data.lastUpdated;
				this.heroesMap.clear();
				for (const hero of data.heroes) {
					if (hero.uuid) {
						this.heroesMap.set(hero.uuid, hero)
					}
				}
				this.requestUpdate();
			} catch (e) {
				console.error("Failed to parse cache", e);
			}
		}
	}

	private clearCache() {
		this.lastUpdated = 0;
		this.heroesMap.clear();
		const data: LocalStorageCache = {
			lastUpdated: this.lastUpdated,
			heroes: []
		};
		localStorage.setItem(LOCAL_STORAGE_CACHE_KEY, JSON.stringify(data));
	}

	private saveToCache() {
		const data: LocalStorageCache = {
			lastUpdated: this.lastUpdated,
			heroes: Array.from(this.heroesMap.values())
		};
		localStorage.setItem(LOCAL_STORAGE_CACHE_KEY, JSON.stringify(data));
		this.requestUpdate();
	}

	private async fetchHeroesClearCache(silent: boolean = false) {
		this.clearCache();
		await this.fetchHeroes(silent);
	}

	private async fetchHeroes(silent: boolean = false) {
		if (!silent) this.isSyncing = true;
		try {
			const response = await fetch(`${API_BASE_URL}/api/heroes?lastUpdated=${this.lastUpdated}`, { credentials: 'include' });
			if (response.ok) {
				const data = await response.json() as HeroesSyncResponse;
				this.lastUpdated = data.lastUpdated;
				for (const hero of data.heroes as Hero[]) {
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

				if (this.heroesMap.size === 0 && data.activeUuids && data.activeUuids.length > 0) {
					this.fetchHeroesClearCache(silent);
					return;
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
			console.error("Failed to fetch heroes", e);
			this.dispatchEvent(new CustomEvent('fatal-error', { detail: STATE_FATAL_NETWORK }));
		} finally {
			if (!silent) this.isSyncing = false;
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

		try {
			const method = heroData.uuid !== null ? 'PUT' : 'POST';
			const url = heroData.uuid !== null ? `${API_BASE_URL}/api/heroes/${heroData.uuid}` : `${API_BASE_URL}/api/heroes`;

			const res = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify(heroData)
			});

			if (res.ok) {
				const updatedHero = await res.json() as Hero;
				if (updatedHero.uuid) {
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
			console.error("Failed to save hero data", e);
			this.dispatchEvent(new CustomEvent('fatal-error', { detail: STATE_FATAL_NETWORK }));
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
