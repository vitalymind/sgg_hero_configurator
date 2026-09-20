import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HeroFormDialog } from '../../src/components/hero_form_dialog';
import { Hero } from '@hero_manager/shared';

describe('HeroFormDialog component', () => {
	let element: HeroFormDialog;

	beforeEach(() => {
		HeroFormDialog.register();
		element = document.createElement('hero-form-dialog') as HeroFormDialog;
		document.body.appendChild(element);
	});

	afterEach(() => {
		element.remove();
	});

	it('renders nothing when isOpen is false', async () => {
		element.isOpen = false;
		await element.updateComplete;

		expect(element.shadowRoot?.querySelector('.modal-container')).toBeNull();
	});

	it('renders "Add New Hero" modal when isOpen is true and editingHero is null', async () => {
		element.isOpen = true;
		await element.updateComplete;

		const modal = element.shadowRoot?.querySelector('.modal-container');
		expect(modal).not.toBeNull();
		expect(element.shadowRoot?.querySelector('h1')?.textContent).toBe('Add New Hero');

		// Save button should be disabled because initial form is invalid (empty name)
		const saveButton = element.shadowRoot?.querySelector('button.primary') as HTMLButtonElement;
		expect(saveButton.disabled).toBe(true);
	});

	it('populates inputs when editingHero is provided', async () => {
		const mockHero: Hero = {
			uuid: '99999999-9999-9999-9999-999999999999',
			name: 'Lancelot',
			attack: 80,
			defense: 70,
			special_skill_id: 'holy_strike',
			status: 'active',
		};

		element.editingHero = mockHero;
		element.isOpen = true;
		await element.updateComplete;

		expect(element.shadowRoot?.querySelector('h1')?.textContent).toBe('Edit Hero');
		expect(element.shadowRoot?.querySelector('.uuid-span')?.textContent).toContain(mockHero.uuid);

		const deleteBtn = element.shadowRoot?.querySelector('button.delete');
		expect(deleteBtn).not.toBeNull();

		const saveButton = element.shadowRoot?.querySelector('button.primary') as HTMLButtonElement;
		expect(saveButton.disabled).toBe(false);
	});

	it('emits save-hero event with valid data when save button is clicked', async () => {
		const mockHero: Hero = {
			uuid: '99999999-9999-9999-9999-999999999999',
			name: 'Galahad',
			attack: 50,
			defense: 50,
			special_skill_id: 'shield_bash',
			status: 'active',
		};

		element.editingHero = mockHero;
		element.isOpen = true;
		await element.updateComplete;

		const saveSpy = vi.fn();
		element.addEventListener('save-hero', saveSpy);

		const saveButton = element.shadowRoot?.querySelector('button.primary') as HTMLButtonElement;
		saveButton.click();

		expect(saveSpy).toHaveBeenCalledTimes(1);
		const eventDetail = saveSpy.mock.calls[0][0].detail;
		expect(eventDetail.name).toBe('Galahad');
		expect(eventDetail.attack).toBe(50);
		expect(eventDetail.defense).toBe(50);
	});

	it('shows confirmation dialog and emits delete-hero event on confirmed deletion', async () => {
		const mockHero: Hero = {
			uuid: '99999999-9999-9999-9999-999999999999',
			name: 'Mordred',
			attack: 60,
			defense: 40,
			special_skill_id: 'betrayal',
			status: 'active',
		};

		element.editingHero = mockHero;
		element.isOpen = true;
		await element.updateComplete;

		const deleteSpy = vi.fn();
		element.addEventListener('delete-hero', deleteSpy);

		// 1. Click delete button to open confirm modal
		const deleteBtn = element.shadowRoot?.querySelector('button.delete') as HTMLButtonElement;
		deleteBtn.click();
		await element.updateComplete;

		expect(element.shadowRoot?.querySelector('h3')?.textContent).toBe('Confirm Deletion');

		// 2. Click confirm delete
		const confirmDeleteBtn = element.shadowRoot?.querySelector('.dialog-actions button.delete') as HTMLButtonElement;
		confirmDeleteBtn.click();

		expect(deleteSpy).toHaveBeenCalledTimes(1);
		expect(deleteSpy.mock.calls[0][0].detail).toEqual(mockHero);
	});

	it('updates name and special skill when user types into inputs', async () => {
		element.isOpen = true;
		await element.updateComplete;

		// Type name
		const inputs = element.shadowRoot?.querySelectorAll('.form-group input[type="text"]') as
			NodeListOf<HTMLInputElement>;
		const nameInput = inputs[0];
		nameInput.value = 'Lancelot';
		nameInput.dispatchEvent(new Event('input'));

		// Type special skill
		const skillInput = inputs[inputs.length - 1];
		skillInput.value = 'holy_light';
		skillInput.dispatchEvent(new Event('input'));
		await element.updateComplete;

		// After typing valid name and skill, save button should become enabled
		const saveButton = element.shadowRoot?.querySelector('button.primary') as HTMLButtonElement;
		expect(saveButton.disabled).toBe(false);
	});

	it('clamps attack to 1000 and rejects non-digits', async () => {
		element.isOpen = true;
		await element.updateComplete;

		const attackInputs = element.shadowRoot?.querySelectorAll('.slider-group input[type="text"]') as
			NodeListOf<HTMLInputElement>;
		const attackInput = attackInputs[0];

		// Typing 9999 -> should clamp to MAX_ATTACK_DEFENSE_VALUE (1000)
		attackInput.value = '9999';
		attackInput.dispatchEvent(new Event('input'));
		await element.updateComplete;
		expect(attackInput.value).toBe('1000');

		// Typing non-digit letters -> should reject and revert to last valid (1000)
		attackInput.value = 'abc';
		attackInput.dispatchEvent(new Event('input'));
		await element.updateComplete;
		expect(attackInput.value).toBe('1000');

		// Empty string -> resets to 0
		attackInput.value = '';
		attackInput.dispatchEvent(new Event('input'));
		await element.updateComplete;
	});

	it('updates values when moving attack and defense sliders', async () => {
		element.isOpen = true;
		await element.updateComplete;

		const sliders = element.shadowRoot?.querySelectorAll('input[type="range"]') as NodeListOf<HTMLInputElement>;
		sliders[0].value = '75';
		sliders[0].dispatchEvent(new Event('input'));

		sliders[1].value = '85';
		sliders[1].dispatchEvent(new Event('input'));
		await element.updateComplete;

		const textInputs = element.shadowRoot?.querySelectorAll('.slider-group input[type="text"]') as
			NodeListOf<HTMLInputElement>;
		expect(textInputs[0].value).toBe('75');
		expect(textInputs[1].value).toBe('85');
	});

	it('cancels deletion when clicking Cancel in confirm dialog', async () => {
		element.editingHero = {
			uuid: '99999999-9999-9999-9999-999999999999',
			name: 'Mordred',
			attack: 50,
			defense: 50,
			special_skill_id: 'slash',
			status: 'active',
		};
		element.isOpen = true;
		await element.updateComplete;

		// Open confirm dialog
		const deleteBtn = element.shadowRoot?.querySelector('button.delete') as HTMLButtonElement;
		deleteBtn.click();
		await element.updateComplete;

		// Click Cancel
		const cancelBtn = element.shadowRoot?.querySelector('.dialog-actions button') as HTMLButtonElement;
		cancelBtn.click();
		await element.updateComplete;

		expect(element.shadowRoot?.querySelector('h3')).toBeNull();
		expect(element.shadowRoot?.querySelector('h1')?.textContent).toBe('Edit Hero');
	});

	it('copies UUID to clipboard on click', async () => {
		const clipboardSpy = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, 'clipboard', {
			value: { writeText: clipboardSpy },
			configurable: true,
		});

		element.editingHero = {
			uuid: '99999999-9999-9999-9999-999999999999',
			name: 'Arthur',
			attack: 50,
			defense: 50,
			special_skill_id: 'excalibur',
			status: 'active',
		};
		element.isOpen = true;
		await element.updateComplete;

		const copySpan = element.shadowRoot?.querySelector('.uuid-span-copy') as HTMLSpanElement;
		copySpan.click();

		expect(clipboardSpy).toHaveBeenCalledWith('99999999-9999-9999-9999-999999999999');
	});
});
