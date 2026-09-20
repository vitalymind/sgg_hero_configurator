import { LitElement, html, css, TemplateResult, PropertyValues, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import {
	STATE_CONNECTING_FAILED,
	STATE_CONNECTING_INIT,
	STATE_CERT_MISSING,
	STATE_AUTH_EMAIL,
	STATE_AUTH_SENDING_OTP,
	STATE_AUTH_OTP,
	STATE_AUTH_VERIFYING,
	STATE_AUTH_EXPIRED,
	STATE_FATAL_NETWORK,
	STATE_FATAL_SERVER,
	STATE_FATAL_CLIENT,
	STATE_SYNCING_DATA,
	STATE_FATAL_VALIDATION,
	LoginSchema,
	SignUpSchema,
	VerifyOtpSchema
} from '../constants';
import { modalBackdropStyle, modalContainerStyle, inputStyle } from '../common_styles';

export class StatusScreenCover extends LitElement {
	static register() {
		if (!customElements.get('status-screen-cover')) {
			customElements.define('status-screen-cover', StatusScreenCover);
		}
	}

	@property({ type: Number }) loadingState = STATE_CONNECTING_INIT;
	@property({ type: Boolean }) isRetrying = false;
	@property({ type: String }) otpErrorMessage = '';
	@property({ type: String }) authErrorMessage = '';

	@state() private authTab: 'login' | 'signup' = 'login';
	@state() private emailInput = '';
	@state() private nameInput = '';
	@state() private otpInput = '';
	@state() private resendCountdown = 0;

	private resendTimerInterval: number | null = null;

	clean() {
		this.emailInput = '';
		this.nameInput = '';
		this.otpInput = '';
		this.otpErrorMessage = '';
		this.authErrorMessage = '';
		this.authTab = 'login';
		this.stopResendTimer();
	}

	disconnectedCallback() {
		super.disconnectedCallback();
		this.stopResendTimer();
	}

	protected willUpdate(changedProperties: PropertyValues) {
		super.willUpdate(changedProperties);
		if (changedProperties.has('loadingState')) {
			if (this.loadingState === STATE_AUTH_OTP) {
				if (this.resendCountdown === 0 && this.resendTimerInterval === null) {
					this.startResendTimer(60);
				}
			} else if (this.loadingState !== STATE_AUTH_VERIFYING) {
				this.stopResendTimer();
			}
		}
	}

	private startResendTimer(seconds = 60) {
		this.stopResendTimer();
		this.resendCountdown = seconds;
		this.resendTimerInterval = window.setInterval(() => {
			if (this.resendCountdown > 1) {
				this.resendCountdown--;
			} else {
				this.stopResendTimer();
			}
		}, 1000);
	}

	private stopResendTimer() {
		if (this.resendTimerInterval !== null) {
			clearInterval(this.resendTimerInterval);
			this.resendTimerInterval = null;
		}
		this.resendCountdown = 0;
	}

	private get emailValidation() {
		return LoginSchema.safeParse({ email: this.emailInput });
	}

	private get isEmailValid(): boolean {
		return this.emailValidation.success;
	}

	private get nameValidation() {
		return SignUpSchema.shape.name.safeParse(this.nameInput);
	}

	private get isNameValid(): boolean {
		return this.nameValidation.success;
	}

	private get signUpValidation() {
		return SignUpSchema.safeParse({ name: this.nameInput, email: this.emailInput });
	}

	private get isSignUpValid(): boolean {
		return this.signUpValidation.success;
	}

	private get otpFieldValidation() {
		return VerifyOtpSchema.shape.otp.safeParse(this.otpInput);
	}

	private get otpValidation() {
		return VerifyOtpSchema.safeParse({ email: this.emailInput, otp: this.otpInput });
	}

	private get isOtpValid(): boolean {
		return this.otpValidation.success;
	}

	private handleSendOtp() {
		if (!this.isEmailValid) {
			return;
		}
		this.authErrorMessage = '';
		this.dispatchEvent(new CustomEvent('send-otp', { detail: { email: this.emailInput } }));
	}

	private handleSignUp() {
		if (!this.isSignUpValid) {
			return;
		}
		this.authErrorMessage = '';
		this.dispatchEvent(
			new CustomEvent('sign-up', {
				detail: { name: this.nameInput, email: this.emailInput }
			})
		);
	}

	private handleResendOtp() {
		if (this.resendCountdown > 0) {
			return;
		}
		this.otpErrorMessage = '';
		if (this.authTab === 'signup' && this.nameInput.trim().length > 0) {
			this.handleSignUp();
		} else {
			this.handleSendOtp();
		}
		this.startResendTimer(60);
	}

	private handleVerifyOtp() {
		if (!this.isOtpValid) {
			return;
		}
		this.otpErrorMessage = '';
		this.dispatchEvent(new CustomEvent('verify-otp', { detail: { email: this.emailInput, otp: this.otpInput } }));
	}

	private handleBackToAuth() {
		this.otpInput = '';
		this.otpErrorMessage = '';
		this.stopResendTimer();
		this.dispatchEvent(new CustomEvent('back-to-auth'));
	}

	private handleEmailInput(e: Event) {
		this.emailInput = (e.target as HTMLInputElement).value;
		this.authErrorMessage = '';
	}

	private handleNameInput(e: Event) {
		this.nameInput = (e.target as HTMLInputElement).value;
		this.authErrorMessage = '';
	}

	private handleOtpInput(e: Event) {
		this.otpInput = (e.target as HTMLInputElement).value;
		this.otpErrorMessage = '';
	}

	private handleOtpPaste(e: ClipboardEvent) {
		e.preventDefault();
		const pasted = e.clipboardData?.getData('text') || '';
		const digits = pasted.replace(/\D/g, '').slice(0, 6);
		this.otpInput = digits;
		this.otpErrorMessage = '';
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
			.subtext {
				color: #4b5563;
				font-size: 0.9em;
				line-height: 1.4;
			}
			.auth-tabs {
				display: flex;
				border-bottom: 2px solid black;
				margin-bottom: 10px;
				gap: 0;
			}
			.tab-btn {
				flex: 1;
				padding: 8px 16px;
				background: #f3f4f6;
				border: none;
				border-bottom: 3px solid transparent;
				font-size: 15px;
				font-weight: bold;
				cursor: pointer;
				color: #6b7280;
				transition: all 0.15s ease;
			}
			.tab-btn:hover {
				color: black;
				background: #e5e7eb;
			}
			.tab-btn.active {
				background: white;
				color: black;
				border-bottom: 3px solid black;
			}
			.form-group {
				display: flex;
				flex-direction: column;
				gap: 5px;
			}
			.form-group label {
				font-weight: bold;
				font-size: 0.9em;
			}
			.dialog-actions {
				display: flex;
				justify-content: flex-end;
				gap: 10px;
				margin-top: 10px;
			}
			.dialog-actions-spread {
				display: flex;
				justify-content: space-between;
				align-items: center;
				margin-top: 15px;
				gap: 10px;
			}
			.action-buttons {
				display: flex;
				gap: 10px;
				align-items: center;
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
			button.link-btn {
				background: none;
				border: none;
				color: #4b5563;
				cursor: pointer;
				text-decoration: underline;
				padding: 4px 6px;
				font-size: 0.85em;
				font-weight: 500;
			}
			button.link-btn:hover {
				color: black;
			}
			.otp-input {
				font-size: 24px;
				letter-spacing: 6px;
				text-align: center;
				font-weight: bold;
			}
			.hint {
				font-size: 0.85em;
				opacity: 0.7;
			}
			.error-msg {
				color: #ef4444;
				font-size: 0.85em;
			}
			.form-error {
				color: #ef4444;
				font-size: 0.85em;
				margin-bottom: 8px;
				padding: 6px 10px;
				background: #fef2f2;
				border: 1px solid #fecaca;
				border-radius: 4px;
			}
			.retry-btn {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				gap: 8px;
			}
			.retry-btn .icon-slot {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 14px;
				height: 14px;
			}
			.retry-btn .spinner {
				width: 12px;
				height: 12px;
				border: 2px solid currentColor;
				border-top-color: transparent;
				border-radius: 50%;
				animation: spin 0.8s linear infinite;
				box-sizing: border-box;
			}
			@keyframes spin {
				to {
					transform: rotate(360deg);
				}
			}
		`
	];

	private renderAuthForm(): TemplateResult {
		const isLogin = this.authTab === 'login';
		const isSending = this.loadingState === STATE_AUTH_SENDING_OTP;

		const hasEmailError = this.emailInput.length > 0 && !this.isEmailValid;
		const emailError =
			hasEmailError && !this.emailValidation.success
				? this.emailValidation.error.flatten().fieldErrors.email?.[0]
				: undefined;

		const hasNameError = !isLogin && this.nameInput.length > 0 && !this.isNameValid;
		const nameError =
			hasNameError && !this.nameValidation.success
				? this.nameValidation.error.issues[0]?.message
				: undefined;

		return html`
			<h1>SGG Hero Configurator</h1>
			<div class="auth-tabs">
				<button
					type="button"
					class="tab-btn ${isLogin ? 'active' : ''}"
					?disabled=${isSending}
					@click=${() => {
						this.authTab = 'login';
						this.authErrorMessage = '';
					}}
				>
					Log In
				</button>
				<button
					type="button"
					class="tab-btn ${!isLogin ? 'active' : ''}"
					?disabled=${isSending}
					@click=${() => {
						this.authTab = 'signup';
						this.authErrorMessage = '';
					}}
				>
					Sign Up
				</button>
			</div>

			${this.authErrorMessage
				? html`<div class="form-error">${this.authErrorMessage}</div>`
				: ''}

			${!isLogin
				? html`
						<div class="form-group">
							<label>Name</label>
							<input
								class="input-field ${hasNameError ? 'error' : ''}"
								type="text"
								placeholder="Display name"
								?disabled=${isSending}
								.value=${this.nameInput}
								@input=${this.handleNameInput}
								@keydown=${(e: KeyboardEvent) => {
									if (e.key === 'Enter') {
										e.preventDefault();
										if (this.isSignUpValid && !isSending) {
											this.handleSignUp();
										}
									}
								}}
							/>
							${nameError ? html`<span class="error-msg">${nameError}</span>` : ''}
						</div>
				  `
				: ''}

			<div class="form-group">
				<label>Email</label>
				<input
					class="input-field ${hasEmailError ? 'error' : ''}"
					type="email"
					placeholder="name@company.com"
					?disabled=${isSending}
					.value=${this.emailInput}
					@input=${this.handleEmailInput}
					@keydown=${(e: KeyboardEvent) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							if (!isSending) {
								if (isLogin) {
									if (this.isEmailValid) {
										this.handleSendOtp();
									}
								} else {
									if (this.isSignUpValid) {
										this.handleSignUp();
									}
								}
							}
						}
					}}
				/>
				${emailError ? html`<span class="error-msg">${emailError}</span>` : ''}
			</div>

			<div class="dialog-actions">
				${isLogin
					? html`
							<button
								type="button"
								class="primary retry-btn"
								?disabled=${!this.isEmailValid || isSending}
								@click=${this.handleSendOtp}
							>
								<span>${isSending ? 'Sending OTP...' : 'Send OTP'}</span>
								${isSending
									? html`<span class="icon-slot"><span class="spinner" aria-hidden="true"></span></span>`
									: nothing}
							</button>
					  `
					: html`
							<button
								type="button"
								class="primary"
								?disabled=${!this.isSignUpValid || isSending}
								@click=${this.handleSignUp}
							>
								${isSending ? 'Signing Up...' : 'Sign Up'}
							</button>
					  `}
			</div>
		`;
	}

	private renderOtpForm(): TemplateResult {
		const isVerifying = this.loadingState === STATE_AUTH_VERIFYING;
		const isPatternValid = this.otpFieldValidation.success;
		const hasFormatError = this.otpInput.length > 0 && !isPatternValid;
		const formatError =
			hasFormatError && !this.otpFieldValidation.success
				? this.otpFieldValidation.error.issues[0]?.message
				: undefined;

		const displayError = this.otpErrorMessage || formatError;
		const hasError = Boolean(displayError);

		return html`
			<h1>Hero Configurator</h1>
			<h2>Enter Verification Code</h2>
			<p class="subtext">
				We sent a 6-digit code to <strong>${this.emailInput}</strong>
			</p>
			<div class="form-group">
				<label>6-Digit OTP</label>
				<input
					class="input-field otp-input ${hasError ? 'error' : ''}"
					type="text"
					inputmode="numeric"
					autocomplete="one-time-code"
					maxlength="6"
					placeholder="000000"
					?disabled=${isVerifying}
					.value=${this.otpInput}
					@input=${this.handleOtpInput}
					@paste=${this.handleOtpPaste}
					@keydown=${(e: KeyboardEvent) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							if (this.isOtpValid && !isVerifying) {
								this.handleVerifyOtp();
							}
						}
					}}
				/>
				${displayError ? html`<span class="error-msg">${displayError}</span>` : ''}
			</div>
			<div class="dialog-actions-spread">
				<button
					type="button"
					class="link-btn"
					?disabled=${isVerifying}
					@click=${this.handleBackToAuth}
				>
					← Change Email
				</button>
				<div class="action-buttons">
					<button
						type="button"
						?disabled=${this.resendCountdown > 0 || isVerifying}
						@click=${this.handleResendOtp}
					>
						${this.resendCountdown > 0 ? `Resend in ${this.resendCountdown}s` : 'Resend Code'}
					</button>
					<button
						type="button"
						class="primary retry-btn"
						?disabled=${!this.isOtpValid || isVerifying}
						@click=${this.handleVerifyOtp}
					>
						<span>Verify & Log In</span>
						<span class="icon-slot">
							${isVerifying
								? html`<span class="spinner" aria-hidden="true"></span>`
								: html`<span class="arrow" aria-hidden="true">→</span>`}
						</span>
					</button>
				</div>
			</div>
		`;
	}

	private renderRetryButton(label = 'Retry'): TemplateResult {
		return html`
			<button
				type="button"
				class="primary retry-btn"
				?disabled=${this.isRetrying}
				@click=${() => this.dispatchEvent(new CustomEvent('retry'))}
			>
				<span>${label}</span>
				<span class="icon-slot">
					${this.isRetrying
						? html`<span class="spinner" aria-hidden="true"></span>`
						: html`<span class="arrow" aria-hidden="true">→</span>`}
				</span>
			</button>
		`;
	}

	private renderConnectionFailed(): TemplateResult {
		return html`
			<h2>Unable to Connect 🔌</h2>
			<p>Could not reach the server. Please verify that the server is running and your connection is active.</p>
			<div class="dialog-actions">
				${this.renderRetryButton()}
			</div>
		`;
	}

	private renderCertMissing(): TemplateResult {
		return html`
			<h2>🔒 Device Certificate Required</h2>
			<p>Unable to establish a secure connection with the server.</p>
			<p class="hint">
				Access is restricted to authorized studio devices with a valid client certificate installed.
				Please verify your device certificate is enrolled and retry.
			</p>
			<div class="dialog-actions">
				${this.renderRetryButton('Retry Connection')}
			</div>
		`;
	}

	private renderSessionExpired(): TemplateResult {
		return html`
			<h2>Session expired ⏱️</h2>
			<p>Please log in again.</p>
			<div class="dialog-actions">
				<button type="button" class="primary" @click=${() => this.dispatchEvent(new CustomEvent('relog'))}>Log In</button>
			</div>
		`;
	}

	private renderNetworkError(): TemplateResult {
		return html`
			<h2>Network Error 📶</h2>
			<p>Unable to reach the server. Please check your internet connection.</p>
			<div class="dialog-actions">
				${this.renderRetryButton()}
			</div>
		`;
	}

	private renderServerError(): TemplateResult {
		return html`
			<h2>Server Error 🖥️</h2>
			<p>The server encountered a problem. Please try again later.</p>
			<div class="dialog-actions">
				${this.renderRetryButton()}
			</div>
		`;
	}

	private renderClientError(): TemplateResult {
		return html`
			<h2>Client Error ❌</h2>
			<p>An unexpected error occurred in the application.</p>
			<div class="dialog-actions">
				${this.renderRetryButton()}
			</div>
		`;
	}

	private renderValidationError(): TemplateResult {
		return html`
			<h2>Validation Error ⚠️</h2>
			<p>The hero data did not pass server validation.</p>
			<div class="dialog-actions">
				${this.renderRetryButton()}
			</div>
		`;
	}

	private renderStatusContent(): TemplateResult | typeof nothing {
		switch (this.loadingState) {
			case STATE_CONNECTING_INIT:
				return html`<h1>Connecting to server...</h1>`;
			case STATE_CONNECTING_FAILED:
				return this.renderConnectionFailed();
			case STATE_CERT_MISSING:
				return this.renderCertMissing();
			case STATE_AUTH_EMAIL:
			case STATE_AUTH_SENDING_OTP:
				return this.renderAuthForm();
			case STATE_AUTH_OTP:
			case STATE_AUTH_VERIFYING:
				return this.renderOtpForm();
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
				return html`<h2>Synchronizing data with server...</h2>`;
			default:
				return nothing;
		}
	}

	render() {
		const content = this.renderStatusContent();
		if (content === nothing) {
			return nothing;
		}
		return html`
			<div class="modal-backdrop">
				<div class="modal-container">
					${content}
				</div>
			</div>
		`;
	}
}
