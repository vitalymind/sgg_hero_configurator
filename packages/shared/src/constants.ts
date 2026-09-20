export const NAME_REGEX = /^[A-Za-z0-9_\- ]+$/;
export const USER_NAME_REGEX = /^[\p{L}\p{N}_\- ']+$/u;
export const SPECIAL_SKILL_ID_REGEX = /^[a-z0-9_\-]+$/;
export const UUID_REGEX = /^[a-z0-9\-]+$/;

export const MAX_STRING_LENGTH = 50;
export const MAX_USER_NAME_LENGTH = 25;
export const MIN_NUMERIC_VALUE = 0;
export const MAX_NUMERIC_VALUE = 1000;
export const MAX_ATTACK_DEFENSE_VALUE = 1000;

export const SESSION_LENGTH_MINUTES = 60;
export const HEARTBEAT_SEND_RATE_SECONDS = 10;
export const HEARTBEAT_TIMEOUT_SECONDS = 15;

export const HERO_STATUSES = ['active', 'deleted'] as const;
export type HeroStatus = (typeof HERO_STATUSES)[number];
