import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { Hero } from '../interfaces.ts';
import { modalBackdropStyle, modalContainerStyle } from '../common_styles.ts';

@customElement('hero-card')
export class HeroCard extends LitElement {
	@property({ type: Object }) hero!: Hero;

	static styles = [
		modalBackdropStyle,
		modalContainerStyle,
		css`
			.card {
				border: 4px solid black;
				padding: 15px;
				display: flex;
				flex-direction: column;
				gap: 10px;
				background: white;
				height: 100%;
				cursor: pointer;
				box-sizing: border-box;
			}
			.card:hover:not(:has(.delete:hover)) {
				background: #f0f0f0;
			}
			.header {
				font-size: 1.2rem;
				font-weight: bold;
				word-break: break-all;
			}
			.sub-header {
				font-size: 1.0rem;
				font-weight: bold;
			}
			.stats {
				display: flex;
				gap: 15px;
			}
			`
	];

	render() {
		return html`
			<div class="card" @click=${() => this.dispatchEvent(new CustomEvent('edit-hero', { detail: this.hero }))}>
				<div class="header">${this.hero.name}</div>
				<div class="stats">
					<span>⚔️ ${this.hero.attack}</span>
					<span>🛡️ ${this.hero.defense}</span>
				</div>
				<div class="skill"><span class="sub-header">Skill</span>: ${this.hero.special_skill_id}</div>
			</div>
		`;
	}
}
