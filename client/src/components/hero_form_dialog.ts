import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { Hero } from '../interfaces.ts';
import { ALLOWED_NAME_CHARACTERS, ALLOWED_SPECIAL_ID_CHARACTERS, MAX_ATTACK_SLIDER_AMOUNT, MAX_DEFENSE_SLIDER_AMOUNT, MAX_ATTACK_DEFENSE_VALUE } from '../constants.ts';
import { modalBackdropStyle, modalContainerStyle, inputStyle } from '../common_styles.ts';

@customElement('hero-form-dialog')
export class HeroFormDialog extends LitElement {
	@property({ type: Object }) editingHero: Hero | null = null;
	@property({ type: Boolean }) isOpen = false;

	@state() private showConfirmDialog = false;
	@state() private name = '';
	@state() private attack = 0;
	@state() private defense = 0;
	@state() private special_skill_id = '';

	private lastValidAttack = '0';
	private lastValidDefense = '0';

	static styles = [
		modalBackdropStyle,
		modalContainerStyle,
		inputStyle,
		css`
			h1 {
				margin-bottom: 0;
			}
			.form-group {
				display: flex;
				flex-direction: column;
				gap: 5px;
			}
			.form-group label {
				font-weight: bold;
			}
			.slider-group {
				display: flex;
				align-items: center;
				gap: 10px;
			}
			.slider-group input[type="range"] {
				flex-grow: 1;
			}
			.slider-group input[type="text"] {
				width: 50px;
			}
			.dialog-actions {
				display: flex;
				justify-content: flex-end;
				gap: 10px;
				margin-top: 10px;
			}
			button {
				padding: 8px 12px;
				border: 2px solid black;
				background: white;
				cursor: pointer;
				font-weight: bold;
			}
			button:disabled {
				opacity: 0.5;
				cursor: not-allowed;
			}
			button.primary {
				background: black;
				color: white;
			}
			button.delete {
				background: red;
				color: white;
				margin-right: auto;
			}
			.uuid-span {
				font-size: 1.0em;
				font-weight: normal;
			}
			.uuid-span-copy {
				cursor: pointer;
				background-color: transparent;
				transition: background-color 0.5s ease-out;
				border-radius: 4px;
				padding: 2px;
			}
			.uuid-span-copy:active {
				background-color: #4ade80; /* bright green */
				transition: background-color 0s;
			}
		`
	];

	clean() {
		this.name = '';
		this.attack = 0;
		this.defense = 0;
		this.special_skill_id = '';
		this.lastValidAttack = '0';
		this.lastValidDefense = '0';
	}

	updated(changedProperties: Map<string, any>) {
		if (changedProperties.has('editingHero') || changedProperties.has('isOpen')) {
			if (this.isOpen) {
				if (this.editingHero) {
					this.name = this.editingHero.name;
					this.attack = this.editingHero.attack;
					this.defense = this.editingHero.defense;
					this.special_skill_id = this.editingHero.special_skill_id;
					this.lastValidAttack = this.attack.toString();
					this.lastValidDefense = this.defense.toString();
				} else {
					this.name = '';
					this.attack = 0;
					this.defense = 0;
					this.special_skill_id = '';
					this.lastValidAttack = '0';
					this.lastValidDefense = '0';
				}
			}
		}
	}

	private isNameValid() {
		if (!this.name) {
			return false;
		}
		return this.name.split('').every(char => ALLOWED_NAME_CHARACTERS.includes(char));
	}

	private isSpecialSkillValid() {
		if (!this.special_skill_id) {
			return false;
		}
		return this.special_skill_id.split('').every(char => ALLOWED_SPECIAL_ID_CHARACTERS.includes(char));
	}

	private isValid() {
		return this.isNameValid() && this.isSpecialSkillValid();
	}

	private handleNameInput(e: Event) {
		this.name = (e.target as HTMLInputElement).value;
	}

	private handleSpecialSkillInput(e: Event) {
		this.special_skill_id = (e.target as HTMLInputElement).value;
	}

	private handleAttackInput(e: Event) {
		const input = e.target as HTMLInputElement;
		const val = input.value;
		if (val === '') {
			this.attack = 0;
			this.lastValidAttack = '0';
			return;
		}
		if (/^\d+$/.test(val)) {
			const maxed = Math.min(MAX_ATTACK_DEFENSE_VALUE, parseInt(val, 10));
			this.attack = maxed;
			this.lastValidAttack = maxed.toString();
			
			if (val !== this.lastValidAttack) {
				input.value = this.lastValidAttack;
			}
		} else {
			input.value = this.lastValidAttack;
		}
	}

	private handleDefenseInput(e: Event) {
		const input = e.target as HTMLInputElement;
		const val = input.value;
		if (val === '') {
			this.defense = 0;
			this.lastValidDefense = '0';
			return;
		}
		if (/^\d+$/.test(val)) {
			const maxed = Math.min(MAX_ATTACK_DEFENSE_VALUE, parseInt(val, 10));
			this.defense = maxed;
			this.lastValidDefense = maxed.toString();
			
			if (val !== this.lastValidDefense) {
				input.value = this.lastValidDefense;
			}
		} else {
			input.value = this.lastValidDefense;
		}
	}

	private handleAttackSlider(e: Event) {
		const val = (e.target as HTMLInputElement).value;
		this.attack = parseInt(val, 10);
		this.lastValidAttack = val;
	}

	private handleDefenseSlider(e: Event) {
		const val = (e.target as HTMLInputElement).value;
		this.defense = parseInt(val, 10);
		this.lastValidDefense = val;
	}

	private closeDialog() {
		this.showConfirmDialog = false;
		this.dispatchEvent(new CustomEvent('close-dialog'));
	}

	private confirmDelete() {
		this.dispatchEvent(new CustomEvent('delete-hero', { detail: this.editingHero }));
		this.showConfirmDialog = false;
		this.closeDialog();
	}

	private saveHero() {
		if (!this.isValid()) { return };

		const heroData: Hero = {
			uuid: this.editingHero ? this.editingHero.uuid : null,
			name: this.name,
			attack: this.attack,
			defense: this.defense,
			special_skill_id: this.special_skill_id,
			status: this.editingHero?.status || 'active'
		};
		this.dispatchEvent(new CustomEvent('save-hero', { detail: heroData }));
	}

	render() {
		if (!this.isOpen) { return html`` };

		if (this.showConfirmDialog) {
			return html`
				<div class="modal-backdrop">
					<div class="modal-container">
						<h3>Confirm Deletion</h3>
						<p>Are you sure you want to delete ${this.editingHero?.name}?</p>
						<div class="dialog-actions">
							<button @click=${() => this.showConfirmDialog = false}>Cancel</button>
							<button class="delete" @click=${this.confirmDelete}>🗑️ Delete</button>
						</div>
					</div>
				</div>
			`;
		}

		const nameErrorClass = (this.name && !this.isNameValid()) || !this.name ? 'error' : '';
		const skillErrorClass = (this.special_skill_id && !this.isSpecialSkillValid()) || !this.special_skill_id ? 'error' : '';

		return html`
			<div class="modal-backdrop">
				<div class="modal-container">
					${
						this.editingHero ?
						html`
						<h1>Edit Hero</h1>
						<span class="uuid-span">uuid: ${this.editingHero.uuid}
							<span class="uuid-span-copy" @click="${() => navigator.clipboard.writeText(this.editingHero ? this.editingHero.uuid! : '')}">📋</span>
						</span>` :
						html`<h1>Add New Hero</h1>`
					}

					<div class="form-group">
						<label>Name</label>
						<input class="input-field ${nameErrorClass}" type="text" .value="${this.name}" @input="${this.handleNameInput}">
					</div>

					<div class="form-group">
						<label>Attack</label>
						<div class="slider-group">
							<input type="range" min="0" max="${MAX_ATTACK_SLIDER_AMOUNT}" .value="${this.attack.toString()}" @input="${this.handleAttackSlider}">
							<input class="input-field" type="text" .value="${this.attack.toString()}" @input="${this.handleAttackInput}">
						</div>
					</div>

					<div class="form-group">
						<label>Defense</label>
						<div class="slider-group">
							<input type="range" min="0" max="${MAX_DEFENSE_SLIDER_AMOUNT}" .value="${this.defense.toString()}" @input="${this.handleDefenseSlider}">
							<input class="input-field" type="text" .value="${this.defense.toString()}" @input="${this.handleDefenseInput}">
						</div>
					</div>

					<div class="form-group">
						<label>Special Skill ID</label>
						<input class="input-field ${skillErrorClass}" type="text" .value="${this.special_skill_id}" @input="${this.handleSpecialSkillInput}">
					</div>

					<div class="dialog-actions">
						${this.editingHero ? html`<button class="delete" @click="${() => this.showConfirmDialog = true}">🗑️ Delete</button>` : ''}
						<button @click="${this.closeDialog}">↩️ Cancel</button>
						<button class="primary" ?disabled="${!this.isValid()}" @click="${this.saveHero}">${this.editingHero ? '💾 Save' : '➕ Add hero'}</button>
					</div>
				</div>
			</div>
		`;
	}
}
