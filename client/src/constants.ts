export const STATE_CONNECTING_INIT = 0;
export const STATE_CONNECTING_FAILED = 1;
export const STATE_CERT_MISSING = 2;
export const STATE_AUTH_EMAIL = 3;
export const STATE_AUTH_SENDING_OTP = 4;
export const STATE_AUTH_OTP = 5;
export const STATE_AUTH_VERIFYING = 6;
export const STATE_AUTH_EXPIRED = 8;
export const STATE_FATAL_NETWORK = 9;
export const STATE_FATAL_SERVER = 10;
export const STATE_FATAL_CLIENT = 11;
export const STATE_SYNCING_DATA = 12;
export const STATE_FATAL_VALIDATION = 13;

export const MAX_ATTACK_SLIDER_AMOUNT = 100;
export const MAX_DEFENSE_SLIDER_AMOUNT = 100;
export const LOCAL_STORAGE_CACHE_KEY = 'hero_manager_cache';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export {
	NAME_REGEX,
	USER_NAME_REGEX,
	SPECIAL_SKILL_ID_REGEX,
	UUID_REGEX,
	MAX_STRING_LENGTH,
	MAX_ATTACK_DEFENSE_VALUE,
	HEARTBEAT_TIMEOUT_SECONDS,
	CreateHeroBodySchema,
	UpdateHeroBodySchema,
	HeroSchema,
	HeroesSyncResponseSchema,
	LocalStorageCacheSchema,
	LoginSchema,
	SignUpSchema,
	VerifyOtpSchema
} from '@hero_manager/shared';