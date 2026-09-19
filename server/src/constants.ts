export * from '@hero_manager/shared';

export const ALLOWED_CORS_DOMAIN = process.env.ALLOWED_CORS_DOMAINS ? process.env.ALLOWED_CORS_DOMAINS.split(',') : ['http://localhost:5173'];