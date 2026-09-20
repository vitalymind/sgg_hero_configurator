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
	@state() private otpErrorMessage = '';
	@state() private authErrorMessage = '';
	@state() private currentUser: { name: string; email: string } | null = null;
	private isSubmittingAuth = false;

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
							.otpErrorMessage=${this.otpErrorMessage}
							.authErrorMessage=${this.authErrorMessage}
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
							.currentUser=${this.currentUser}
							@fatal-error=${(e: CustomEvent) => {
								this.loadingState = e.detail;
								this.showStatusCover = true;
							}}
							@logout=${this.handleLogout}
						></hero-manager>
				  `}
		`;
	}

	private async handleLogout(): Promise<void> {
		if (this.isSubmittingAuth) {
			return;
		}
		this.isSubmittingAuth = true;
		try {
			await fetch(`${API_BASE_URL}/api/logout`, {
				method: 'POST',
				credentials: 'include'
			});
		} catch (error) {
			console.error('Logout request failed', error);
		} finally {
			this.clean();
			this.loadingState = STATE_AUTH_EMAIL;
			this.showStatusCover = true;
			this.isSubmittingAuth = false;
		}
	}

	private clean() {
		if (this.manager) {
			this.manager.clean();
		}
		if (this.statusCover) {
			this.statusCover.clean();
		}
		this.currentUser = null;
		this.otpErrorMessage = '';
		this.authErrorMessage = '';
		this.isSubmittingAuth = false;
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
		this.otpErrorMessage = '';
		this.authErrorMessage = '';
		this.loadingState = STATE_AUTH_EMAIL;
	}

	private async initServerConnection(): Promise<void> {
		try {
			const result = await fetch(`${API_BASE_URL}/api/connect`, { credentials: 'include' });
			if (result.status === 200) {
				const data = (await result.json().catch(() => ({}))) as { user?: { email: string; name: string } | null };
				if (data.user) {
					this.currentUser = data.user;
				}
				this.showStatusCover = false;
			} else if (result.status === 401) {
				this.currentUser = null;
				this.loadingState = STATE_AUTH_EMAIL;
			} else if (result.status === 403) {
				this.currentUser = null;
				this.loadingState = STATE_CERT_MISSING;
			} else {
				this.currentUser = null;
				this.loadingState = STATE_CONNECTING_FAILED;
			}
		} catch (error: unknown) {
			this.currentUser = null;
			this.loadingState = STATE_CONNECTING_FAILED;
			if (error instanceof Error) {
				console.error(error.message);
			} else {
				console.error(error);
			}
		}
	}

	private async handleSendOtp(e: CustomEvent) {
		if (this.isSubmittingAuth) {
			return;
		}
		const parseResult = LoginSchema.safeParse(e.detail);
		if (!parseResult.success) {
			this.authErrorMessage = parseResult.error.issues[0]?.message || 'Please enter a valid email address';
			return;
		}

		this.isSubmittingAuth = true;
		const { email } = parseResult.data;
		const isAlreadyOnOtp = this.loadingState === STATE_AUTH_OTP || this.loadingState === STATE_AUTH_VERIFYING;

		if (!isAlreadyOnOtp) {
			this.loadingState = STATE_AUTH_SENDING_OTP;
			this.authErrorMessage = '';
		}

		try {
			const res = await fetch(`${API_BASE_URL}/api/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ email })
			});

			if (res.ok) {
				this.loadingState = STATE_AUTH_OTP;
				this.otpErrorMessage = '';
				this.authErrorMessage = '';
			} else if (res.status >= 500) {
				this.loadingState = STATE_FATAL_SERVER;
			} else {
				const data = (await res.json().catch(() => ({}))) as { message?: string };
				if (isAlreadyOnOtp) {
					this.loadingState = STATE_AUTH_OTP;
					this.otpErrorMessage = data.message || 'Failed to resend verification code';
				} else {
					this.loadingState = STATE_AUTH_EMAIL;
					this.authErrorMessage = data.message || 'Failed to send verification code';
				}
			}
		} catch (error) {
			console.error('Failed to send OTP', error);
			this.loadingState = STATE_FATAL_NETWORK;
		} finally {
			this.isSubmittingAuth = false;
		}
	}

	private async handleSignUp(e: CustomEvent) {
		if (this.isSubmittingAuth) {
			return;
		}
		const parseResult = SignUpSchema.safeParse(e.detail);
		if (!parseResult.success) {
			this.authErrorMessage = parseResult.error.issues[0]?.message || 'Please check the form for errors';
			return;
		}

		this.isSubmittingAuth = true;
		const { email, name } = parseResult.data;
		const isAlreadyOnOtp = this.loadingState === STATE_AUTH_OTP || this.loadingState === STATE_AUTH_VERIFYING;

		if (!isAlreadyOnOtp) {
			this.loadingState = STATE_AUTH_SENDING_OTP;
			this.authErrorMessage = '';
		}

		try {
			const res = await fetch(`${API_BASE_URL}/api/signup`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ email, name })
			});

			if (res.ok) {
				this.loadingState = STATE_AUTH_OTP;
				this.otpErrorMessage = '';
				this.authErrorMessage = '';
			} else if (res.status >= 500) {
				this.loadingState = STATE_FATAL_SERVER;
			} else {
				const data = (await res.json().catch(() => ({}))) as { message?: string };
				if (isAlreadyOnOtp) {
					this.loadingState = STATE_AUTH_OTP;
					this.otpErrorMessage = data.message || 'Failed to resend verification code';
				} else {
					this.loadingState = STATE_AUTH_EMAIL;
					this.authErrorMessage = data.message || 'Failed to sign up';
				}
			}
		} catch (error) {
			console.error('Failed to sign up', error);
			this.loadingState = STATE_FATAL_NETWORK;
		} finally {
			this.isSubmittingAuth = false;
		}
	}

	private async handleVerifyOtp(e: CustomEvent) {
		if (this.isSubmittingAuth) {
			return;
		}
		const parseResult = VerifyOtpSchema.safeParse(e.detail);
		if (!parseResult.success) {
			this.loadingState = STATE_AUTH_OTP;
			this.otpErrorMessage = parseResult.error.issues[0]?.message || 'Invalid verification code';
			return;
		}

		this.isSubmittingAuth = true;
		this.loadingState = STATE_AUTH_VERIFYING;
		this.otpErrorMessage = '';
		const { email, otp } = parseResult.data;

		try {
			const result = await fetch(`${API_BASE_URL}/api/login/verify`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ email, otp })
			});

			if (result.ok) {
				const data = (await result.json().catch(() => ({}))) as { user?: { email: string; name: string } | null };
				if (data.user) {
					this.currentUser = data.user;
				}
				this.showStatusCover = false;
				this.otpErrorMessage = '';
			} else if (result.status >= 500) {
				this.loadingState = STATE_FATAL_SERVER;
			} else {
				const data = (await result.json().catch(() => ({}))) as { message?: string };
				this.loadingState = STATE_AUTH_OTP;
				this.otpErrorMessage = data.message || 'Invalid or expired verification code';
			}
		} catch (error) {
			console.error('Failed to verify OTP', error);
			this.loadingState = STATE_FATAL_NETWORK;
		} finally {
			this.isSubmittingAuth = false;
		}
	}
}

HeroConfigurator.register();
