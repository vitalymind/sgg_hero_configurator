import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { Hero } from '../interfaces.ts';
import './hero_card.ts';

@customElement('hero-list')
export class HeroList extends LitElement {
	@property({ type: Array }) heroes: Hero[] = [];
	@property({ type: String }) filterQuery = '';

	clean(): void {}

	static styles = css`
		:host {
			display: flex;
			flex-direction: column;
			gap: 20px;
		}

		.control-panel {
			position: sticky;
			top: 0;
			background: white;
			padding: 15px;
			border: 4px solid black;
			display: flex;
			flex-wrap: wrap;
			gap: 10px;
			justify-content: space-between;
			align-items: center;
			z-index: 100;
		}

		.filter-input {
			border: 2px solid black;
			padding: 8px;
			font-size: 16px;
			outline: none;
			width: 250px;
		}

		.refresh-btn {
			padding: 8px 12px;
			border: 2px solid black;
			background: black;
			color: white;
			cursor: pointer;
			font-weight: bold;
		}

		.control-actions {
			display: flex;
			gap: 10px;
		}

		.hero-grid {
			display: grid;
			gap: 20px;
			grid-template-columns: repeat(4, 1fr);
		}

		@media (max-width: 1024px) {
			.hero-grid {
				grid-template-columns: repeat(2, 1fr);
			}
		}

		@media (max-width: 600px) {
			.hero-grid {
				grid-template-columns: 1fr;
			}
			.control-panel {
				flex-direction: column;
				align-items: stretch;
			}
			.control-actions {
				flex-direction: column;
				align-items: stretch;
			}
			.filter-input {
				width: auto;
			}
		}

		.add-card {
			border: 4px dashed black;
			display: flex;
			justify-content: center;
			align-items: center;
			font-size: 4rem;
			cursor: pointer;
			background: white;
			height: 100%;
			min-height: 130px;
			box-sizing: border-box;
			transition: background 0.2s;
		}
		.add-card:hover {
			background: #f0f0f0;
		}
	`;

	render() {
		return html`
				<div class="control-panel">
					<input class="filter-input" type="text" placeholder="Filter heroes by name..." .value="${this.filterQuery}" @input="${(e: Event) => this.dispatchEvent(new CustomEvent('filter-changed', { detail: (e.target as HTMLInputElement).value }))}">
					<div class="control-actions">
						<button class="refresh-btn" @click="${() => this.dispatchEvent(new CustomEvent('create-hero'))}">➕ Add hero</button>
						<button class="refresh-btn" @click="${() => this.dispatchEvent(new CustomEvent('refresh-heroes'))}">🔄 Refresh</button>
						<button class="refresh-btn" @click="${() => this.dispatchEvent(new CustomEvent('refresh-heroes-cache'))}">🧼 Clear cache</button>
					</div>
				</div>

				<div class="hero-grid">
					<div class="add-card" @click="${() => this.dispatchEvent(new CustomEvent('create-hero'))}">+</div>
					${this.heroes.map(hero => html`
						<hero-card 
							.hero="${hero}"
							@edit-hero="${(e: CustomEvent) => this.dispatchEvent(new CustomEvent('edit-hero', { detail: e.detail }))}"
						></hero-card>
					`)}
				</div>
			`;
	}
}
