export const STATE_CONNECTING_INIT = 0;
export const STATE_CONNECTING_FAILED = 1;
export const STATE_AUTH_EMAIL = 3;
export const STATE_AUTH_SENDING_OTP = 4;
export const STATE_AUTH_OTP = 5;
export const STATE_AUTH_VERIFYING = 6;
export const STATE_AUTH_FAILED = 7;
export const STATE_AUTH_EXPIRED = 8;
export const STATE_FATAL_NETWORK = 9;
export const STATE_FATAL_SERVER = 10;
export const STATE_FATAL_CLIENT = 11;
export const STATE_SYNCING_DATA = 12;
export const STATE_FATAL_VALIDATION = 13;

export const HEARTBEAT_TIMEOUT_SECONDS = 15;

export const MAX_ATTACK_SLIDER_AMOUNT = 100;
export const MAX_DEFENSE_SLIDER_AMOUNT = 100;
export const ALLOWED_NAME_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_ 0123456789'.split('');
export const ALLOWED_SPECIAL_ID_CHARACTERS = 'abcdefghijklmnopqrstuvwxyz0123456789-_'.split('');
export const LOCAL_STORAGE_CACHE_KEY = 'hero_manager_cache';

export const MAX_ATTACK_DEFENSE_VALUE = 1000;
export const MAX_STRING_LENGTH = 50;