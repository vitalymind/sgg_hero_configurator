import { LitElement, html, css } from 'lit';
import { state, query } from 'lit/decorators.js';
import { STATE_SYNCING_DATA } from '../constants';
import { HeroSyncController } from '../services/hero_sync_controller';
import { HeroList } from './hero_list';
import { HeroFormDialog } from './hero_form_dialog';
import { StatusScreenCover } from './status_screen_cover';
import { DraftHero, Hero } from '@hero_manager/shared';

export class HeroManager extends LitElement {
	static register() {
		HeroList.register();
		HeroFormDialog.register();
		StatusScreenCover.register();
		if (!customElements.get('hero-manager')) {
			customElements.define('hero-manager', HeroManager);
		}
	}

	readonly sync = new HeroSyncController(this);

	@state() private filterQuery = '';
	@state() private isDialogOpen = false;
	@state() private currentEditHero: Hero | null = null;

	@query('hero-list') heroList?: HeroList;
	@query('hero-form-dialog') formDialog?: HeroFormDialog;

	clean() {
		this.filterQuery = '';
		this.isDialogOpen = false;
		this.currentEditHero = null;
		this.heroList?.clean();
		this.formDialog?.clean();
	}

	static styles = css`
		:host {
			display: block;
			max-width: 1200px;
			margin: 0 auto;
			padding: 20px;
		}
	`;

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
		await this.sync.saveHero({ ...hero, status: 'deleted' });
	}

	private handleCloseDialog() {
		this.isDialogOpen = false;
		this.currentEditHero = null;
	}

	private async handleSaveHero(e: CustomEvent) {
		const heroData = e.detail as Hero | DraftHero;
		this.isDialogOpen = false;
		await this.sync.saveHero(heroData);
	}

	render() {
		const visibleHeroes = Array.from(this.sync.heroesMap.values())
			.filter((h) => h.status !== 'deleted')
			.filter((h) => h.name.toLocaleLowerCase().includes(this.filterQuery.toLocaleLowerCase()));

		return html`
			<hero-list 
				.heroes="${visibleHeroes}"
				.filterQuery="${this.filterQuery}"
				@filter-changed="${this.handleFilterChanged}"
				@refresh-heroes="${() => this.sync.fetchHeroes(false)}"
				@refresh-heroes-cache="${() => this.sync.fetchHeroesClearCache(false)}"
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

			${this.sync.isSyncing ? html`<status-screen-cover .loadingState=${STATE_SYNCING_DATA}></status-screen-cover>` : ''}
		`;
	}
}
