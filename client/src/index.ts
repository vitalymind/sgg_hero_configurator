import { StatusScreenCover } from './components/status_screen_cover';
import { HeroManager } from './components/hero_manager';

import { LitElement, html } from 'lit';
import { state, query } from 'lit/decorators.js';
import {
	STATE_CONNECTING_FAILED,
	STATE_CONNECTING_INIT,
	STATE_CERT_MISSING,
	STATE_AUTH_EMAIL,
	STATE_AUTH_SENDING_OTP,
	STATE_AUTH_OTP,
	STATE_AUTH_VERIFYING,
	STATE_AUTH_FAILED,
	STATE_FATAL_SERVER,
	STATE_FATAL_NETWORK,
	API_BASE_URL,
	LoginSchema,
	SignUpSchema,
	VerifyOtpSchema
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
	@state() private isRetrying = false;

	@query('hero-manager') manager?: HeroManager;
	@query('status-screen-cover') statusCover?: StatusScreenCover;

	connectedCallback() {
		super.connectedCallback();
		this.initServerConnection();
	}

	render() {
		return html`
			${this.showStatusCover
				? html`
						<status-screen-cover
							.loadingState=${this.loadingState}
							.isRetrying=${this.isRetrying}
							@send-otp=${this.handleSendOtp}
							@sign-up=${this.handleSignUp}
							@verify-otp=${this.handleVerifyOtp}
							@back-to-auth=${this.backToAuth}
							@retry=${this.restartApp}
							@relog=${this.relogin}
						>
						</status-screen-cover>
				  `
				: html`
						<hero-manager
							@fatal-error=${(e: CustomEvent) => {
								this.loadingState = e.detail;
								this.showStatusCover = true;
							}}
						></hero-manager>
				  `}
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

	private async restartApp(): Promise<void> {
		this.clean();
		this.isRetrying = true;
		try {
			await this.initServerConnection();
		} finally {
			this.isRetrying = false;
		}
	}

	private relogin() {
		this.clean();
		this.loadingState = STATE_AUTH_EMAIL;
	}

	private backToAuth() {
		this.loadingState = STATE_AUTH_EMAIL;
	}

	private async initServerConnection(): Promise<void> {
		try {
			const result = await fetch(`${API_BASE_URL}/api/connect`, { credentials: 'include' });
			if (result.status === 200) {
				this.showStatusCover = false;
			} else if (result.status === 401) {
				this.loadingState = STATE_AUTH_EMAIL;
			} else if (result.status === 403) {
				this.loadingState = STATE_CERT_MISSING;
			} else {
				this.loadingState = STATE_CONNECTING_FAILED;
			}
		} catch (error: unknown) {
			this.loadingState = STATE_CONNECTING_FAILED;
			if (error instanceof Error) {
				console.error(error.message);
			} else {
				console.error(error);
			}
		}
	}

	private async handleSendOtp(e: CustomEvent) {
		const parseResult = LoginSchema.safeParse(e.detail);
		if (!parseResult.success) {
			this.loadingState = STATE_AUTH_FAILED;
			return;
		}

		this.loadingState = STATE_AUTH_SENDING_OTP;
		const { email } = parseResult.data;

		try {
			const res = await fetch(`${API_BASE_URL}/api/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
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
			console.error('Failed to send OTP', error);
			this.loadingState = STATE_FATAL_NETWORK;
		}
	}

	private async handleSignUp(e: CustomEvent) {
		const parseResult = SignUpSchema.safeParse(e.detail);
		if (!parseResult.success) {
			this.loadingState = STATE_AUTH_FAILED;
			return;
		}

		this.loadingState = STATE_AUTH_SENDING_OTP;
		const { email, name } = parseResult.data;

		try {
			const res = await fetch(`${API_BASE_URL}/api/signup`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ email, name })
			});

			if (res.ok) {
				this.loadingState = STATE_AUTH_OTP;
			} else if (res.status >= 500) {
				this.loadingState = STATE_FATAL_SERVER;
			} else {
				this.loadingState = STATE_AUTH_FAILED;
			}
		} catch (error) {
			console.error('Failed to sign up', error);
			this.loadingState = STATE_FATAL_NETWORK;
		}
	}

	private async handleVerifyOtp(e: CustomEvent) {
		const parseResult = VerifyOtpSchema.safeParse(e.detail);
		if (!parseResult.success) {
			this.loadingState = STATE_AUTH_FAILED;
			return;
		}

		this.loadingState = STATE_AUTH_VERIFYING;
		const { email, otp } = parseResult.data;

		try {
			const result = await fetch(`${API_BASE_URL}/api/login/verify`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
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
			console.error('Failed to verify OTP', error);
			this.loadingState = STATE_FATAL_NETWORK;
		}
	}
}

HeroConfigurator.register();
