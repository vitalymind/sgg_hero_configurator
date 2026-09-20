import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HeroFormDialog } from '../../src/components/hero_form_dialog';
import { Hero } from '../../src/interfaces';

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
});
