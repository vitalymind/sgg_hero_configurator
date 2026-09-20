import type {
	Hero as SharedHero,
	HeroesSyncResponse as SharedHeroesSyncResponse,
	LocalStorageCache as SharedLocalStorageCache
} from '@hero_manager/shared';

export type Hero = SharedHero;

export type DraftHero = Omit<Hero, 'uuid' | 'id'>;

export type HeroesSyncResponse = SharedHeroesSyncResponse;
export type LocalStorageCache = SharedLocalStorageCache;
