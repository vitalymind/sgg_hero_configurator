import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { HeroConfigurator } from '../../src/index';
import {
	STATE_CONNECTING_FAILED,
	STATE_FATAL_SERVER,
	STATE_AUTH_EMAIL,
	STATE_AUTH_OTP
} from '../../src/constants';

describe('HeroConfigurator root component', () => {
	let app: HeroConfigurator;

	beforeEach(() => {
		HeroConfigurator.register();
		app = document.createElement('hero-configurator') as HeroConfigurator;
	});

	afterEach(() => {
		app.remove();
	});

	it('renders hero-manager and hides status cover when /api/connect returns 200', async () => {
		document.body.appendChild(app);

		await vi.waitFor(() => {
			expect(app.shadowRoot?.querySelector('hero-manager')).not.toBeNull();
		});

		expect(app.shadowRoot?.querySelector('status-screen-cover')).toBeNull();
	});

	it('displays connection failed screen when /api/connect encounters a network error', async () => {
		server.use(
			http.get('*/api/connect', () => {
				return HttpResponse.error();
			})
		);

		document.body.appendChild(app);

		await vi.waitFor(() => {
			const cover = app.shadowRoot?.querySelector('status-screen-cover') as any;
			expect(cover).not.toBeNull();
			expect(cover.loadingState).toBe(STATE_CONNECTING_FAILED);
		});

		expect(app.shadowRoot?.querySelector('hero-manager')).toBeNull();
	});

	it('overlays status-screen-cover when hero-manager dispatches fatal-error', async () => {
		document.body.appendChild(app);

		await vi.waitFor(() => {
			expect(app.shadowRoot?.querySelector('hero-manager')).not.toBeNull();
		});

		const heroManager = app.shadowRoot?.querySelector('hero-manager');
		heroManager?.dispatchEvent(
			new CustomEvent('fatal-error', {
				detail: STATE_FATAL_SERVER,
				bubbles: true,
				composed: true,
			})
		);

		await vi.waitFor(() => {
			const cover = app.shadowRoot?.querySelector('status-screen-cover') as any;
			expect(cover).not.toBeNull();
			expect(cover.loadingState).toBe(STATE_FATAL_SERVER);
		});
	});

	it('retries connection when retry event is emitted by status cover', async () => {
		// 1. Fail connection first
		server.use(
			http.get('*/api/connect', () => {
				return HttpResponse.error();
			})
		);

		document.body.appendChild(app);

		await vi.waitFor(() => {
			const cover = app.shadowRoot?.querySelector('status-screen-cover') as any;
			expect(cover).not.toBeNull();
			expect(cover.loadingState).toBe(STATE_CONNECTING_FAILED);
		});

		// 2. Restore /api/connect to 200 OK
		server.resetHandlers();

		// 3. Emit retry event from cover
		const cover = app.shadowRoot?.querySelector('status-screen-cover') as any;
		cover.dispatchEvent(new CustomEvent('retry'));

		await vi.waitFor(() => {
			expect(app.shadowRoot?.querySelector('hero-manager')).not.toBeNull();
		});

		expect(app.shadowRoot?.querySelector('status-screen-cover')).toBeNull();
	});

	it('displays login/signup cover when /api/connect returns 401', async () => {
		server.use(
			http.get('*/api/connect', () => {
				return new HttpResponse(null, { status: 401 });
			})
		);

		document.body.appendChild(app);

		await vi.waitFor(() => {
			const cover = app.shadowRoot?.querySelector('status-screen-cover') as any;
			expect(cover).not.toBeNull();
			expect(cover.loadingState).toBe(STATE_AUTH_EMAIL);
		});
	});

	it('handles sign-up event, sends request to /api/signup, and transitions to STATE_AUTH_OTP', async () => {
		server.use(
			http.get('*/api/connect', () => {
				return new HttpResponse(null, { status: 401 });
			})
		);

		document.body.appendChild(app);

		await vi.waitFor(() => {
			const cover = app.shadowRoot?.querySelector('status-screen-cover') as any;
			expect(cover).not.toBeNull();
			expect(cover.loadingState).toBe(STATE_AUTH_EMAIL);
		});

		const cover = app.shadowRoot?.querySelector('status-screen-cover') as any;
		cover.dispatchEvent(
			new CustomEvent('sign-up', {
				detail: { name: 'Bob Builder', email: 'bob@company.com' }
			})
		);

		await vi.waitFor(() => {
			expect(cover.loadingState).toBe(STATE_AUTH_OTP);
		});
	});

	it('handles verify-otp event and unlocks hero-manager on 200 OK', async () => {
		server.use(
			http.get('*/api/connect', () => {
				return new HttpResponse(null, { status: 401 });
			})
		);

		document.body.appendChild(app);

		await vi.waitFor(() => {
			const cover = app.shadowRoot?.querySelector('status-screen-cover') as any;
			expect(cover).not.toBeNull();
		});

		const cover = app.shadowRoot?.querySelector('status-screen-cover') as any;
		cover.dispatchEvent(
			new CustomEvent('verify-otp', {
				detail: { email: 'bob@company.com', otp: '123456' }
			})
		);

		await vi.waitFor(() => {
			expect(app.shadowRoot?.querySelector('hero-manager')).not.toBeNull();
		});

		expect(app.shadowRoot?.querySelector('status-screen-cover')).toBeNull();
	});

	it('handles back-to-auth event and transitions from OTP back to STATE_AUTH_EMAIL', async () => {
		server.use(
			http.get('*/api/connect', () => {
				return new HttpResponse(null, { status: 401 });
			})
		);

		document.body.appendChild(app);

		await vi.waitFor(() => {
			const cover = app.shadowRoot?.querySelector('status-screen-cover') as any;
			expect(cover).not.toBeNull();
		});

		const cover = app.shadowRoot?.querySelector('status-screen-cover') as any;
		cover.dispatchEvent(
			new CustomEvent('send-otp', {
				detail: { email: 'alice@company.com' }
			})
		);

		await vi.waitFor(() => {
			expect(cover.loadingState).toBe(STATE_AUTH_OTP);
		});

		cover.dispatchEvent(new CustomEvent('back-to-auth'));

		await vi.waitFor(() => {
			expect(cover.loadingState).toBe(STATE_AUTH_EMAIL);
		});
	});
});
