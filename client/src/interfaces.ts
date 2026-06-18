export interface Hero {
	id?: number;
	uuid: string | null;
	name: string;
	attack: number;
	defense: number;
	special_skill_id: string;
	status: 'active' | 'deleted';
}

export interface HeroesSyncResponse {
    lastUpdated: number;
    heroes: Hero[];
}

export interface LocalStorageCache {
    lastUpdated: number;
    heroes: Hero[];
}
