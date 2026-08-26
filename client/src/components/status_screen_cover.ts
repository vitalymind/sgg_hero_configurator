import { LitElement, html, css, TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import {
	STATE_CONNECTING_FAILED,
	STATE_CONNECTING_INIT,
	STATE_AUTH_EMAIL,
	STATE_AUTH_SENDING_OTP,
	STATE_AUTH_OTP,
	STATE_AUTH_VERIFYING,
	STATE_AUTH_FAILED,
	STATE_AUTH_EXPIRED,
	STATE_FATAL_NETWORK,
	STATE_FATAL_SERVER,
	STATE_FATAL_CLIENT,
	STATE_SYNCING_DATA,
	STATE_FATAL_VALIDATION
} from '../constants';
import { modalBackdropStyle, modalContainerStyle, inputStyle } from '../common_styles';

export class StatusScreenCover extends LitElement {
	static register() {
		if (!customElements.get('status-screen-cover')) {
			customElements.define('status-screen-cover', StatusScreenCover);
		}
	}

	@property({ type: Number }) loadingState = STATE_CONNECTING_INIT;

	@state() private emailInput = '';
	@state() private otpInput = '';

	clean() {
		this.emailInput = '';
		this.otpInput = '';
	}

	private handleSendOtp() {
		if (!this.emailInput) {
			return;
		}
		this.dispatchEvent(new CustomEvent('send-otp', { detail: { email: this.emailInput } }));
	}

	private handleVerifyOtp() {
		if (!this.otpInput) {
			return;
		}
		this.dispatchEvent(new CustomEvent('verify-otp', { detail: { email: this.emailInput, otp: this.otpInput } }));
	}

	static styles = [
		modalBackdropStyle,
		modalContainerStyle,
		inputStyle,
		css`
			:host {
				display: block;
				z-index: 9999;
			}

			h1 {
				margin-bottom: 0;
			}
			h2 {
				margin-bottom: 0;
				margin-top: 0;
			}
			p {
				margin: 0;
			}
			.form-group {
				display: flex;
				flex-direction: column;
				gap: 5px;
			}
			.form-group label {
				font-weight: bold;
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
			.hint {
				font-size: 0.85em;
				opacity: 0.7;
			}
			.copy-span {
				cursor: pointer;
				background-color: transparent;
				transition: background-color 0.5s ease-out;
				border-radius: 4px;
				padding: 2px;
			}
			.copy-span:active {
				background-color: #4ade80;
				transition: background-color 0s;
			}
		`
	];

	private handleEmailInput(e: Event) {
		this.emailInput = (e.target as HTMLInputElement).value;
	}

	private handleOtpInput(e: Event) {
		this.otpInput = (e.target as HTMLInputElement).value;
	}

	private renderSimpleMessage(title: string): TemplateResult {
		return html`<h2>${title}</h2>`;
	}

	private renderEmailForm(): TemplateResult {
		return html`
			<h1>SGG Hero Configurator</h1>
			<div class="form-group">
				<label>Login</label>
				<span class="hint">Hint: your email is user@email.com
					<span class="copy-span" @click=${() => navigator.clipboard.writeText('user@email.com')}>📋</span>
					or user2@email.com
					<span class="copy-span" @click=${() => navigator.clipboard.writeText('user2@email.com')}>📋</span>
				</span>
				<input
					class="input-field"
					type="email"
					placeholder="Email"
					.value=${this.emailInput}
					@input=${this.handleEmailInput}
					@keydown=${(e: KeyboardEvent) => e.key === 'Enter' && this.handleSendOtp()}
				/>
			</div>
			<div class="dialog-actions">
				<button class="primary" @click=${this.handleSendOtp}>Send OTP</button>
			</div>
		`;
	}

	private renderOtpForm(): TemplateResult {
		return html`
			<h1>SGG Hero Configurator</h1>
			<div class="form-group">
				<label>Enter OTP</label>
				<span class="hint">Hint: your OTP is 123456 <span class="copy-span" @click=${() => navigator.clipboard.writeText('123456')}>📋</span></span>
				<input
					class="input-field"
					type="text"
					placeholder="6-digit OTP"
					.value=${this.otpInput}
					@input=${this.handleOtpInput}
					@keydown=${(e: KeyboardEvent) => e.key === 'Enter' && this.handleVerifyOtp()}
				/>
			</div>
			<div class="dialog-actions">
				<button class="primary" @click=${this.handleVerifyOtp}>Login</button>
			</div>
		`;
	}

	private renderSessionExpired(): TemplateResult {
		return html`
			<h2>Session expired ⏱️</h2>
			<p>Please log in again.</p>
			<div class="dialog-actions">
				<button class="primary" @click=${() => this.dispatchEvent(new CustomEvent('relog'))}>Log In</button>
			</div>
		`;
	}

	private renderNetworkError(): TemplateResult {
		return html`
			<h2>Network Error 📶</h2>
			<p>Unable to reach the server. Please check your internet connection.</p>
			<div class="dialog-actions">
				<button class="primary" @click=${() => this.dispatchEvent(new CustomEvent('retry'))}>Retry</button>
			</div>
		`;
	}

	private renderServerError(): TemplateResult {
		return html`
			<h2>Server Error 🖥️</h2>
			<p>The server encountered a problem. Please try again later.</p>
			<div class="dialog-actions">
				<button class="primary" @click=${() => this.dispatchEvent(new CustomEvent('retry'))}>Retry</button>
			</div>
		`;
	}

	private renderClientError(): TemplateResult {
		return html`
			<h2>Client Error ❌</h2>
			<p>An unexpected error occurred in the application.</p>
			<div class="dialog-actions">
				<button class="primary" @click=${() => this.dispatchEvent(new CustomEvent('retry'))}>Retry</button>
			</div>
		`;
	}

	private renderValidationError(): TemplateResult {
		return html`
			<h2>Validation Error ⚠️</h2>
			<p>The hero data did not pass server validation.</p>
			<div class="dialog-actions">
				<button class="primary" @click=${() => location.reload()}>Reload Page</button>
			</div>
		`;
	}

	private renderStatus(): TemplateResult {
		switch (this.loadingState) {
			case STATE_CONNECTING_FAILED:
				return this.renderSimpleMessage('Server is currently unavailable 🖥️🔌');
			case STATE_AUTH_EMAIL:
				return this.renderEmailForm();
			case STATE_AUTH_SENDING_OTP:
				return this.renderSimpleMessage('Sending OTP...');
			case STATE_AUTH_OTP:
				return this.renderOtpForm();
			case STATE_AUTH_VERIFYING:
				return this.renderSimpleMessage('Verifying...');
			case STATE_AUTH_FAILED:
				return this.renderSimpleMessage('Access denied ❌');
			case STATE_AUTH_EXPIRED:
				return this.renderSessionExpired();
			case STATE_FATAL_NETWORK:
				return this.renderNetworkError();
			case STATE_FATAL_SERVER:
				return this.renderServerError();
			case STATE_FATAL_CLIENT:
				return this.renderClientError();
			case STATE_FATAL_VALIDATION:
				return this.renderValidationError();
			case STATE_SYNCING_DATA:
				return this.renderSimpleMessage('Downloading heroes data...');
			default:
				return this.renderSimpleMessage('Connecting...');
		}
	}

	render() {
		return html`
			<div class="modal-backdrop">
				<div class="modal-container">
					${this.renderStatus()}
				</div>
			</div>
		`;
	}
}
