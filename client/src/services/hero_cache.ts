import { Hero, LocalStorageCache } from '@hero_manager/shared';
import { LOCAL_STORAGE_CACHE_KEY, LocalStorageCacheSchema } from '../constants';

export class HeroCache {
	constructor(private storageKey: string = LOCAL_STORAGE_CACHE_KEY) { }

	load(): LocalStorageCache | null {
		const cached = localStorage.getItem(this.storageKey);
		if (!cached) {
			return null;
		}

		try {
			const raw = JSON.parse(cached);
			const parseResult = LocalStorageCacheSchema.safeParse(raw);
			if (parseResult.success) {
				return parseResult.data;
			}
			console.warn('Cached data failed schema validation, resetting cache:', parseResult.error);
			this.clear();
			return null;
		} catch (e) {
			console.error('Failed to parse cache', e);
			this.clear();
			return null;
		}
	}

	save(lastUpdated: number, heroes: Hero[]): void {
		const data: LocalStorageCache = {
			lastUpdated,
			heroes,
		};
		localStorage.setItem(this.storageKey, JSON.stringify(data));
	}

	clear(): void {
		try {
			localStorage.removeItem(this.storageKey);
		} catch (e) {
			console.warn('Failed to clear cache from localStorage', e);
		}
	}
}

export const heroCache = new HeroCache();
