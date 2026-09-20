import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HeroManager } from '../../src/components/hero_manager';
import { Hero, DraftHero } from '@hero_manager/shared';

describe('HeroManager UI component', () => {
	let manager: HeroManager;

	beforeEach(async () => {
		HeroManager.register();
		manager = document.createElement('hero-manager') as HeroManager;
		document.body.appendChild(manager);
		// Wait for sync controller to load initial mock heroes
		await vi.waitFor(() => expect(manager.sync.heroesMap.size).toBe(2));
		await manager.updateComplete;
	});

	afterEach(() => {
		manager.remove();
	});

	it('renders hero-list and hero-form-dialog sub-components', async () => {
		const heroList = manager.shadowRoot?.querySelector('hero-list');
		const formDialog = manager.shadowRoot?.querySelector('hero-form-dialog');

		expect(heroList).not.toBeNull();
		expect(formDialog).not.toBeNull();
	});

	it('filters heroes visible in hero-list when filter-changed event occurs', async () => {
		const heroList = manager.shadowRoot?.querySelector('hero-list') as any;
		expect(heroList.heroes.length).toBe(2);

		// Trigger filter-changed for "Merlin"
		heroList.dispatchEvent(new CustomEvent('filter-changed', { detail: 'Merlin' }));
		await manager.updateComplete;

		expect(heroList.heroes.length).toBe(1);
		expect(heroList.heroes[0].name).toBe('Merlin the Enchanter');
	});

	it('opens dialog for hero creation when create-hero is triggered', async () => {
		const heroList = manager.shadowRoot?.querySelector('hero-list') as HTMLElement;
		heroList.dispatchEvent(new CustomEvent('create-hero'));
		await manager.updateComplete;

		const formDialog = manager.shadowRoot?.querySelector('hero-form-dialog') as any;
		expect(formDialog.isOpen).toBe(true);
		expect(formDialog.editingHero).toBeNull();
	});

	it('opens dialog for hero editing when edit-hero is triggered', async () => {
		const sampleHero: Hero = {
			uuid: '11111111-1111-1111-1111-111111111111',
			name: 'Arthur Pendragon',
			attack: 75,
			defense: 60,
			special_skill_id: 'excalibur',
			status: 'active',
		};

		const heroList = manager.shadowRoot?.querySelector('hero-list') as HTMLElement;
		heroList.dispatchEvent(new CustomEvent('edit-hero', { detail: sampleHero }));
		await manager.updateComplete;

		const formDialog = manager.shadowRoot?.querySelector('hero-form-dialog') as any;
		expect(formDialog.isOpen).toBe(true);
		expect(formDialog.editingHero).toEqual(sampleHero);
	});

	it('closes dialog when close-dialog event is emitted', async () => {
		const formDialog = manager.shadowRoot?.querySelector('hero-form-dialog') as any;
		// Open first
		manager.shadowRoot?.querySelector('hero-list')?.dispatchEvent(new CustomEvent('create-hero'));
		await manager.updateComplete;
		expect(formDialog.isOpen).toBe(true);

		// Close
		formDialog.dispatchEvent(new CustomEvent('close-dialog'));
		await manager.updateComplete;
		expect(formDialog.isOpen).toBe(false);
	});

	it('delegates save-hero to sync controller', async () => {
		const saveSpy = vi.spyOn(manager.sync, 'saveHero').mockResolvedValue(undefined);

		const newHero: DraftHero = {
			name: 'Kay',
			attack: 40,
			defense: 40,
			special_skill_id: 'strike',
			status: 'active',
		};

		const formDialog = manager.shadowRoot?.querySelector('hero-form-dialog') as any;
		formDialog.dispatchEvent(new CustomEvent('save-hero', { detail: newHero }));

		expect(saveSpy).toHaveBeenCalledWith(newHero);
		expect(formDialog.isOpen).toBe(false);
	});

	it('resets dialog and filter on clean()', async () => {
		// Open dialog and set filter
		manager.shadowRoot?.querySelector('hero-list')?.dispatchEvent(new CustomEvent('create-hero'));
		manager.shadowRoot?.querySelector('hero-list')?.dispatchEvent(new CustomEvent('filter-changed', { detail: 'query' }));
		await manager.updateComplete;

		manager.clean();
		await manager.updateComplete;

		const formDialog = manager.shadowRoot?.querySelector('hero-form-dialog') as any;
		expect(formDialog.isOpen).toBe(false);
	});
});
