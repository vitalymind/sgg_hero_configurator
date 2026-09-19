export const NAME_REGEX = /^[A-Za-z0-9_\- ]+$/;
export const SPECIAL_SKILL_ID_REGEX = /^[a-z0-9_\-]+$/;
export const UUID_REGEX = /^[a-z0-9\-]+$/;

export const SESSION_LENGTH_MINUTES = 60;
export const HEARTBEAT_SEND_RATE_SECONDS = 10;

export const MAX_NUMERIC_VALUE = 1000;
export const MIN_NUMERIC_VALUE = 0;
export const MAX_STRING_LENGTH = 50;

export const ALLOWED_CORS_DOMAIN = process.env.ALLOWED_CORS_DOMAINS ? process.env.ALLOWED_CORS_DOMAINS.split(',') : ['http://localhost:5173'];