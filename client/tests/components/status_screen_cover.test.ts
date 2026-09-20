import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StatusScreenCover } from '../../src/components/status_screen_cover';
import {
	STATE_AUTH_EMAIL,
	STATE_AUTH_OTP,
	STATE_CONNECTING_FAILED,
	STATE_CERT_MISSING
} from '../../src/constants';

describe('StatusScreenCover component', () => {
	let cover: StatusScreenCover;

	beforeEach(() => {
		StatusScreenCover.register();
		cover = document.createElement('status-screen-cover') as StatusScreenCover;
		document.body.appendChild(cover);
	});

	afterEach(() => {
		cover.remove();
	});

	it('renders login tab by default with disabled Send OTP button', async () => {
		cover.loadingState = STATE_AUTH_EMAIL;
		await cover.updateComplete;

		const loginTabBtn = cover.shadowRoot?.querySelector('.tab-btn.active');
		expect(loginTabBtn?.textContent?.trim()).toBe('Log In');

		const sendBtn = cover.shadowRoot?.querySelector('button.primary') as HTMLButtonElement;
		expect(sendBtn).not.toBeNull();
		expect(sendBtn.disabled).toBe(true);

		// Name input should not be in DOM for Login tab
		expect(cover.shadowRoot?.querySelector('input[placeholder*="Display name"]')).toBeNull();
	});

	it('validates email in Login tab and emits send-otp on submission', async () => {
		cover.loadingState = STATE_AUTH_EMAIL;
		await cover.updateComplete;

		const emailInput = cover.shadowRoot?.querySelector('input[type="email"]') as HTMLInputElement;
		const sendBtn = cover.shadowRoot?.querySelector('button.primary') as HTMLButtonElement;

		emailInput.value = 'developer@company.com';
		emailInput.dispatchEvent(new Event('input'));
		await cover.updateComplete;

		expect(sendBtn.disabled).toBe(false);

		const sendOtpSpy = vi.fn();
		cover.addEventListener('send-otp', sendOtpSpy);

		sendBtn.click();
		expect(sendOtpSpy).toHaveBeenCalledTimes(1);
		expect(sendOtpSpy.mock.calls[0][0].detail).toEqual({
			email: 'developer@company.com'
		});
	});

	it('switches to Sign Up tab, validates name and email, and rejects whitespace-only name', async () => {
		cover.loadingState = STATE_AUTH_EMAIL;
		await cover.updateComplete;

		// Click Sign Up tab
		const tabs = cover.shadowRoot?.querySelectorAll('.tab-btn');
		const signUpTabBtn = tabs?.[1] as HTMLButtonElement;
		signUpTabBtn.click();
		await cover.updateComplete;

		const nameInput = cover.shadowRoot?.querySelector('input[placeholder*="Display name"]') as HTMLInputElement;
		const emailInput = cover.shadowRoot?.querySelector('input[type="email"]') as HTMLInputElement;
		const submitBtn = cover.shadowRoot?.querySelector('button.primary') as HTMLButtonElement;

		expect(nameInput).not.toBeNull();
		expect(submitBtn.textContent?.trim()).toBe('Sign Up');
		expect(submitBtn.disabled).toBe(true);

		// Test whitespace-only name is rejected by Zod
		nameInput.value = '   ';
		nameInput.dispatchEvent(new Event('input'));
		emailInput.value = 'newuser@company.com';
		emailInput.dispatchEvent(new Event('input'));
		await cover.updateComplete;

		expect(submitBtn.disabled).toBe(true);

		// Enter valid name
		nameInput.value = 'Alice Developer';
		nameInput.dispatchEvent(new Event('input'));
		await cover.updateComplete;

		expect(submitBtn.disabled).toBe(false);

		const signUpSpy = vi.fn();
		cover.addEventListener('sign-up', signUpSpy);

		submitBtn.click();
		expect(signUpSpy).toHaveBeenCalledTimes(1);
		expect(signUpSpy.mock.calls[0][0].detail).toEqual({
			name: 'Alice Developer',
			email: 'newuser@company.com'
		});
	});

	it('preserves typed email when toggling between Log In and Sign Up tabs', async () => {
		cover.loadingState = STATE_AUTH_EMAIL;
		await cover.updateComplete;

		const emailInput = cover.shadowRoot?.querySelector('input[type="email"]') as HTMLInputElement;
		emailInput.value = 'shared@company.com';
		emailInput.dispatchEvent(new Event('input'));
		await cover.updateComplete;

		// Switch to Sign Up
		const tabs = cover.shadowRoot?.querySelectorAll('.tab-btn');
		(tabs?.[1] as HTMLButtonElement).click();
		await cover.updateComplete;

		const signUpEmailInput = cover.shadowRoot?.querySelector('input[type="email"]') as HTMLInputElement;
		expect(signUpEmailInput.value).toBe('shared@company.com');

		// Switch back to Log In
		(tabs?.[0] as HTMLButtonElement).click();
		await cover.updateComplete;

		const loginEmailInput = cover.shadowRoot?.querySelector('input[type="email"]') as HTMLInputElement;
		expect(loginEmailInput.value).toBe('shared@company.com');
	});

	it('renders OTP screen with email, 6-digit validation, and emits verify-otp', async () => {
		// First set email in login
		cover.loadingState = STATE_AUTH_EMAIL;
		await cover.updateComplete;

		const emailInput = cover.shadowRoot?.querySelector('input[type="email"]') as HTMLInputElement;
		emailInput.value = 'verify@company.com';
		emailInput.dispatchEvent(new Event('input'));
		await cover.updateComplete;

		// Transition to OTP state
		cover.loadingState = STATE_AUTH_OTP;
		await cover.updateComplete;

		const subtext = cover.shadowRoot?.querySelector('.subtext');
		expect(subtext?.textContent).toContain('verify@company.com');

		const otpInput = cover.shadowRoot?.querySelector('input.otp-input') as HTMLInputElement;
		const verifyBtn = cover.shadowRoot?.querySelector('button.primary') as HTMLButtonElement;
		expect(verifyBtn.disabled).toBe(true);

		// Invalid OTP (letters or short)
		otpInput.value = '123';
		otpInput.dispatchEvent(new Event('input'));
		await cover.updateComplete;
		expect(verifyBtn.disabled).toBe(true);

		// Valid 6 digits
		otpInput.value = '654321';
		otpInput.dispatchEvent(new Event('input'));
		await cover.updateComplete;
		expect(verifyBtn.disabled).toBe(false);

		const verifyOtpSpy = vi.fn();
		cover.addEventListener('verify-otp', verifyOtpSpy);

		verifyBtn.click();
		expect(verifyOtpSpy).toHaveBeenCalledTimes(1);
		expect(verifyOtpSpy.mock.calls[0][0].detail).toEqual({
			email: 'verify@company.com',
			otp: '654321'
		});
	});

	it('handles paste event in OTP input and extracts only digits up to 6 characters', async () => {
		cover.loadingState = STATE_AUTH_OTP;
		await cover.updateComplete;

		const otpInput = cover.shadowRoot?.querySelector('input.otp-input') as HTMLInputElement;

		const pasteEvent = new Event('paste', { bubbles: true, cancelable: true }) as any;
		pasteEvent.clipboardData = {
			getData: () => 'Code: 987-654 (verified)'
		};

		otpInput.dispatchEvent(pasteEvent);
		await cover.updateComplete;

		expect((cover as any).otpInput).toBe('987654');
	});

	it('emits back-to-auth when clicking change email link', async () => {
		cover.loadingState = STATE_AUTH_OTP;
		await cover.updateComplete;

		const backBtn = cover.shadowRoot?.querySelector('button.link-btn') as HTMLButtonElement;
		const backSpy = vi.fn();
		cover.addEventListener('back-to-auth', backSpy);

		backBtn.click();
		expect(backSpy).toHaveBeenCalledTimes(1);
	});

	it('renders connection failed screen when connection fails', async () => {
		cover.loadingState = STATE_CONNECTING_FAILED;
		await cover.updateComplete;

		expect(cover.shadowRoot?.textContent).toContain('Unable to Connect');

		const retryBtn = cover.shadowRoot?.querySelector('button.primary') as HTMLButtonElement;
		const retrySpy = vi.fn();
		cover.addEventListener('retry', retrySpy);

		retryBtn.click();
		expect(retrySpy).toHaveBeenCalledTimes(1);
	});

	it('renders device certificate required screen on STATE_CERT_MISSING', async () => {
		cover.loadingState = STATE_CERT_MISSING;
		await cover.updateComplete;

		expect(cover.shadowRoot?.textContent).toContain('Device Certificate Required');
	});

	it('disables retry button and shows spinner when isRetrying is true, and arrow when idle', async () => {
		cover.loadingState = STATE_CONNECTING_FAILED;
		cover.isRetrying = false;
		await cover.updateComplete;

		const idleBtn = cover.shadowRoot?.querySelector('button.primary') as HTMLButtonElement;
		expect(idleBtn.disabled).toBe(false);
		expect(idleBtn.textContent).toContain('Retry');
		expect(idleBtn.textContent).toContain('→');

		cover.isRetrying = true;
		await cover.updateComplete;

		const activeBtn = cover.shadowRoot?.querySelector('button.primary') as HTMLButtonElement;
		expect(activeBtn.disabled).toBe(true);
		expect(activeBtn.querySelector('.spinner')).not.toBeNull();
		expect(activeBtn.textContent).toContain('Retry');
	});

});
