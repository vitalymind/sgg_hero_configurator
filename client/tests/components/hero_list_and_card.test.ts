import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HeroCard } from '../../src/components/hero_card';
import { HeroList } from '../../src/components/hero_list';
import { Hero } from '@hero_manager/shared';

const sampleHero: Hero = {
	uuid: '11111111-1111-1111-1111-111111111111',
	name: 'Arthur Pendragon',
	attack: 75,
	defense: 60,
	special_skill_id: 'excalibur',
	status: 'active',
};

describe('HeroCard component', () => {
	let card: HeroCard;

	beforeEach(() => {
		HeroCard.register();
		card = document.createElement('hero-card') as HeroCard;
		card.hero = sampleHero;
		document.body.appendChild(card);
	});

	afterEach(() => {
		card.remove();
	});

	it('renders hero details correctly', async () => {
		await card.updateComplete;

		expect(card.shadowRoot?.querySelector('.header')?.textContent).toBe('Arthur Pendragon');
		expect(card.shadowRoot?.querySelector('.stats')?.textContent).toContain('75');
		expect(card.shadowRoot?.querySelector('.stats')?.textContent).toContain('60');
		expect(card.shadowRoot?.querySelector('.skill')?.textContent).toContain('excalibur');
	});

	it('dispatches edit-hero event when card is clicked', async () => {
		await card.updateComplete;

		const editSpy = vi.fn();
		card.addEventListener('edit-hero', editSpy);

		const cardDiv = card.shadowRoot?.querySelector('.card') as HTMLDivElement;
		cardDiv.click();

		expect(editSpy).toHaveBeenCalledTimes(1);
		expect(editSpy.mock.calls[0][0].detail).toEqual(sampleHero);
	});
});

describe('HeroList component', () => {
	let list: HeroList;

	beforeEach(() => {
		HeroList.register();
		list = document.createElement('hero-list') as HeroList;
		document.body.appendChild(list);
	});

	afterEach(() => {
		list.remove();
	});

	it('renders hero cards and add card', async () => {
		list.heroes = [sampleHero];
		await list.updateComplete;

		const heroCards = list.shadowRoot?.querySelectorAll('hero-card');
		expect(heroCards?.length).toBe(1);

		const addCard = list.shadowRoot?.querySelector('.add-card');
		expect(addCard).not.toBeNull();
	});

	it('dispatches filter-changed event when typing in filter input', async () => {
		await list.updateComplete;

		const filterSpy = vi.fn();
		list.addEventListener('filter-changed', filterSpy);

		const input = list.shadowRoot?.querySelector('.filter-input') as HTMLInputElement;
		input.value = 'Arthur';
		input.dispatchEvent(new Event('input'));

		expect(filterSpy).toHaveBeenCalledTimes(1);
		expect(filterSpy.mock.calls[0][0].detail).toBe('Arthur');
	});

	it('dispatches control events on button clicks', async () => {
		await list.updateComplete;

		const createSpy = vi.fn();
		const refreshSpy = vi.fn();
		const clearCacheSpy = vi.fn();

		list.addEventListener('create-hero', createSpy);
		list.addEventListener('refresh-heroes', refreshSpy);
		list.addEventListener('refresh-heroes-cache', clearCacheSpy);

		const buttons = list.shadowRoot?.querySelectorAll('.refresh-btn') as NodeListOf<HTMLButtonElement>;
		// Button 0: Add hero, Button 1: Refresh, Button 2: Clear cache
		buttons[0].click();
		buttons[1].click();
		buttons[2].click();

		expect(createSpy).toHaveBeenCalledTimes(1);
		expect(refreshSpy).toHaveBeenCalledTimes(1);
		expect(clearCacheSpy).toHaveBeenCalledTimes(1);
	});
});