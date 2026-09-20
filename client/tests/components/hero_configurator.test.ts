import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { HeroConfigurator } from '../../src/index';
import {
	STATE_CONNECTING_FAILED,
	STATE_FATAL_SERVER,
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
});
