import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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
		await new Promise((resolve) => setTimeout(resolve, 50));
		await app.updateComplete;

		expect(app.shadowRoot?.querySelector('status-screen-cover')).toBeNull();
		expect(app.shadowRoot?.querySelector('hero-manager')).not.toBeNull();
	});

	it('displays connection failed screen when /api/connect encounters a network error', async () => {
		server.use(
			http.get('*/api/connect', () => {
				return HttpResponse.error();
			})
		);

		document.body.appendChild(app);
		await new Promise((resolve) => setTimeout(resolve, 50));
		await app.updateComplete;

		const cover = app.shadowRoot?.querySelector('status-screen-cover') as any;
		expect(cover).not.toBeNull();
		expect(cover.loadingState).toBe(STATE_CONNECTING_FAILED);
		expect(app.shadowRoot?.querySelector('hero-manager')).toBeNull();
	});

	it('overlays status-screen-cover when hero-manager dispatches fatal-error', async () => {
		document.body.appendChild(app);
		await new Promise((resolve) => setTimeout(resolve, 50));
		await app.updateComplete;

		// Initially hero-manager is visible
		const heroManager = app.shadowRoot?.querySelector('hero-manager');
		expect(heroManager).not.toBeNull();

		// hero-manager emits a fatal-error
		heroManager?.dispatchEvent(
			new CustomEvent('fatal-error', {
				detail: STATE_FATAL_SERVER,
				bubbles: true,
				composed: true,
			})
		);

		await app.updateComplete;

		const cover = app.shadowRoot?.querySelector('status-screen-cover') as any;
		expect(cover).not.toBeNull();
		expect(cover.loadingState).toBe(STATE_FATAL_SERVER);
	});

	it('retries connection when retry event is emitted by status cover', async () => {
		// 1. Fail connection first
		server.use(
			http.get('*/api/connect', () => {
				return HttpResponse.error();
			})
		);

		document.body.appendChild(app);
		await new Promise((resolve) => setTimeout(resolve, 50));
		await app.updateComplete;

		const cover = app.shadowRoot?.querySelector('status-screen-cover') as any;
		expect(cover).not.toBeNull();
		expect(cover.loadingState).toBe(STATE_CONNECTING_FAILED);

		// 2. Restore /api/connect to 200 OK
		server.resetHandlers();

		// 3. Emit retry event from cover
		cover.dispatchEvent(new CustomEvent('retry'));
		await new Promise((resolve) => setTimeout(resolve, 50));
		await app.updateComplete;

		// App should successfully connect and show hero-manager
		expect(app.shadowRoot?.querySelector('status-screen-cover')).toBeNull();
		expect(app.shadowRoot?.querySelector('hero-manager')).not.toBeNull();
	});
});
