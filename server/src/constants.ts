import { SESSION_LENGTH_MINUTES } from '@hero_manager/shared';
export * from '@hero_manager/shared';

export const ALLOWED_CORS_DOMAIN = process.env.ALLOWED_CORS_DOMAINS
	? process.env.ALLOWED_CORS_DOMAINS.split(',')
	: ['http://localhost:5173'];

export const MAX_SESSION_AGE_MS = SESSION_LENGTH_MINUTES * 60 * 1000;
export const maxSessionAge = MAX_SESSION_AGE_MS;
export const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
export const OTP_COOLDOWN_MS = 60 * 1000; // 60 seconds per email
export const MAX_OTP_ATTEMPTS = 5;

// Per-IP Rate Limiting for Auth Endpoints
export const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const AUTH_RATE_LIMIT_MAX = 10; // Max 10 requests per window per IP