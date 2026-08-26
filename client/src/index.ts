import { StatusScreenCover } from './components/status_screen_cover';
import { HeroManager } from './components/hero_manager';

import { LitElement, html } from 'lit';
import { state, query } from 'lit/decorators.js';
import {
	STATE_CONNECTING_FAILED,
	STATE_CONNECTING_INIT,
	STATE_AUTH_EMAIL,
	STATE_AUTH_SENDING_OTP,
	STATE_AUTH_OTP,
	STATE_AUTH_VERIFYING,
	STATE_AUTH_FAILED,
	STATE_FATAL_SERVER,
	STATE_FATAL_NETWORK,
	API_BASE_URL
} from './constants';

export class HeroConfigurator extends LitElement {
	static register() {
		StatusScreenCover.register();
		HeroManager.register();
		if (!customElements.get('hero-configurator')) {
			customElements.define('hero-configurator', HeroConfigurator);
		}
	}

	@state() private showStatusCover = true;
	@state() private loadingState = STATE_CONNECTING_INIT;

	@query('hero-manager') manager?: HeroManager;
	@query('status-screen-cover') statusCover?: StatusScreenCover;

	connectedCallback() {
		super.connectedCallback();
		this.initServerConnection();
	}

	render() {
		return html`
			${this.showStatusCover ? html`
				<status-screen-cover
					.loadingState=${this.loadingState}
					@send-otp=${this.handleSendOtp}
					@verify-otp=${this.handleVerifyOtp}
					@retry=${this.restartApp}
					@relog=${this.relogin}>
				</status-screen-cover>
			`: html`<hero-manager @fatal-error=${(e: CustomEvent) => { this.loadingState = e.detail; this.showStatusCover = true; }}></hero-manager>`}
		`;
	}

	private clean() {
		if (this.manager) {
			this.manager.clean();
		}
		if (this.statusCover) {
			this.statusCover.clean();
		}
	}

	private restartApp() {
		this.clean();
		this.loadingState = STATE_CONNECTING_INIT;
		this.initServerConnection();
	}

	private relogin() {
		this.clean();
		this.loadingState = STATE_AUTH_EMAIL;
	}

	private async initServerConnection(): Promise<void> {
		try {
			const result = await fetch(`${API_BASE_URL}/api/connect`, { credentials: 'include' });
			if (result.status === 200) {
				this.showStatusCover = false;
			} else if (result.status === 401) {
				this.loadingState = STATE_AUTH_EMAIL;
			} else {
				this.loadingState = STATE_CONNECTING_FAILED;
			}
		} catch (error: unknown) {
			this.loadingState = STATE_CONNECTING_FAILED;
			if (error instanceof Error) {
				console.error(error.message);
			} else {
				console.error(error)
			}
		}
	}

	private async handleSendOtp(e: CustomEvent) {
		this.loadingState = STATE_AUTH_SENDING_OTP;
		const email = e.detail.email;

		try {
			const res = await fetch(`${API_BASE_URL}/api/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email })
			});

			if (res.ok) {
				this.loadingState = STATE_AUTH_OTP;
			} else if (res.status >= 500) {
				this.loadingState = STATE_FATAL_SERVER;
			} else {
				this.loadingState = STATE_AUTH_FAILED;
			}
		} catch (error) {
			console.error("Failed to send OTP", error);
			this.loadingState = STATE_FATAL_NETWORK;
		}
	}

	private async handleVerifyOtp(e: CustomEvent) {
		this.loadingState = STATE_AUTH_VERIFYING;
		const { email, otp } = e.detail;

		try {
			const result = await fetch(`${API_BASE_URL}/api/login/verify`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, otp })
			});

			if (result.ok) {
				this.showStatusCover = false;
			} else if (result.status >= 500) {
				this.loadingState = STATE_FATAL_SERVER;
			} else {
				this.loadingState = STATE_AUTH_FAILED;
			}
		} catch (error) {
			console.error("Failed to verify OTP", error);
			this.loadingState = STATE_FATAL_NETWORK;
		}
	}
}

HeroConfigurator.register();
