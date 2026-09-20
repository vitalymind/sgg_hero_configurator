import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './mocks/server';

// Lightweight EventSource stub for happy-dom
export class MockEventSource {
	static instances: MockEventSource[] = [];
	url: string;
	onmessage: ((e: { data: string }) => void) | null = null;
	onopen: (() => void) | null = null;
	onerror: ((e: unknown) => void) | null = null;
	readyState = 1;

	constructor(url: string) {
		this.url = url;
		MockEventSource.instances.push(this);
	}

	close() {
		this.readyState = 2;
	}

	emitMessage(data: string) {
		if (this.onmessage) {
			this.onmessage({ data });
		}
	}

	emitOpen() {
		if (this.onopen) {
			this.onopen();
		}
	}

	emitError(err: unknown = new Error('SSE Error')) {
		if (this.onerror) {
			this.onerror(err);
		}
	}
}

globalThis.EventSource = MockEventSource as unknown as typeof EventSource;

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => {
	server.resetHandlers();
	localStorage.clear();
	MockEventSource.instances = [];
});
afterAll(() => server.close());
