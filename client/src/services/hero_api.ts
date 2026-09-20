import { DraftHero, Hero, HeroesSyncResponse } from '@hero_manager/shared';
import {
	API_BASE_URL,
	STATE_FATAL_NETWORK,
	STATE_FATAL_SERVER,
	STATE_FATAL_CLIENT,
	STATE_AUTH_EXPIRED,
	STATE_FATAL_VALIDATION,
	HeroesSyncResponseSchema,
	HeroSchema
} from '../constants';

export class HeroApiError extends Error {
	constructor(public status: number, message: string, public errorCode: number) {
		super(message);
		this.name = 'HeroApiError';
	}
}

export class HeroApiClient {
	constructor(private baseUrl: string = API_BASE_URL) { }

	async fetchHeroes(lastUpdated: number): Promise<HeroesSyncResponse> {
		let response: Response;
		try {
			response = await fetch(`${this.baseUrl}/api/heroes?lastUpdated=${lastUpdated}`, { credentials: 'include' });
		} catch (e) {
			console.error('Network error fetching heroes:', e);
			throw new HeroApiError(0, 'Network error fetching heroes', STATE_FATAL_NETWORK);
		}

		if (!response.ok) {
			if (response.status === 401) {
				throw new HeroApiError(response.status, 'Auth expired', STATE_AUTH_EXPIRED);
			} else if (response.status >= 500) {
				throw new HeroApiError(response.status, 'Server error', STATE_FATAL_SERVER);
			} else {
				throw new HeroApiError(response.status, 'Client error', STATE_FATAL_CLIENT);
			}
		}

		let rawData: unknown;
		try {
			rawData = await response.json();
		} catch (e) {
			console.error('JSON parsing error on heroes response:', e);
			throw new HeroApiError(response.status, 'Invalid JSON response from server', STATE_FATAL_SERVER);
		}

		const parseResult = HeroesSyncResponseSchema.safeParse(rawData);
		if (!parseResult.success) {
			console.error('Heroes sync response failed schema validation:', parseResult.error);
			throw new HeroApiError(response.status, 'Schema validation failed', STATE_FATAL_SERVER);
		}

		return parseResult.data;
	}

	async saveHero(heroData: Hero | DraftHero): Promise<Hero> {
		const isUpdate = 'uuid' in heroData;
		const method = isUpdate ? 'PUT' : 'POST';
		const url = isUpdate ? `${this.baseUrl}/api/heroes/${heroData.uuid}` : `${this.baseUrl}/api/heroes`;

		let response: Response;
		try {
			response = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify(heroData)
			});
		} catch (e) {
			console.error('Network error saving hero data:', e);
			throw new HeroApiError(0, 'Network error saving hero', STATE_FATAL_NETWORK);
		}

		if (!response.ok) {
			if (response.status === 401) {
				throw new HeroApiError(response.status, 'Auth expired', STATE_AUTH_EXPIRED);
			} else if (response.status === 422) {
				throw new HeroApiError(response.status, 'Validation error', STATE_FATAL_VALIDATION);
			} else if (response.status >= 500) {
				throw new HeroApiError(response.status, 'Server error', STATE_FATAL_SERVER);
			} else {
				throw new HeroApiError(response.status, 'Client error', STATE_FATAL_CLIENT);
			}
		}

		let rawData: unknown;
		try {
			rawData = await response.json();
		} catch (e) {
			console.error('JSON parsing error on save hero response:', e);
			throw new HeroApiError(response.status, 'Invalid JSON response from server', STATE_FATAL_SERVER);
		}

		const parseResult = HeroSchema.safeParse(rawData);
		if (!parseResult.success) {
			console.error('Save hero response failed schema validation:', parseResult.error);
			throw new HeroApiError(response.status, 'Schema validation failed', STATE_FATAL_SERVER);
		}

		return parseResult.data;
	}
}

export const heroApiClient = new HeroApiClient();
