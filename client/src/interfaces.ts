import type { Hero as SharedHero } from '@hero_manager/shared';

export type Hero = Omit<SharedHero, 'uuid'> & {
	id?: number;
	uuid: string | null;
};

export interface HeroesSyncResponse {
	lastUpdated: number;
	heroes: Hero[];
	activeUuids: string[];
}

export interface LocalStorageCache {
	lastUpdated: number;
	heroes: Hero[];
}
