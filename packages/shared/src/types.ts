import { z } from 'zod';
import {
	HeroSchema,
	CreateHeroBodySchema,
	UpdateHeroBodySchema,
	HeroQuerySchema,
	HeroParamsSchema,
	LoginSchema,
	VerifyOtpSchema,
	HeroesSyncResponseSchema,
	LocalStorageCacheSchema
} from './schemas.js';

export type Hero = z.infer<typeof HeroSchema>;
export type DraftHero = Omit<Hero, 'uuid' | 'id'>;
export type CreateHeroInput = z.infer<typeof CreateHeroBodySchema>;
export type UpdateHeroInput = z.infer<typeof UpdateHeroBodySchema>;
export type HeroQuery = z.infer<typeof HeroQuerySchema>;
export type HeroParams = z.infer<typeof HeroParamsSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type VerifyOtpInput = z.infer<typeof VerifyOtpSchema>;
export type HeroesSyncResponse = z.infer<typeof HeroesSyncResponseSchema>;
export type LocalStorageCache = z.infer<typeof LocalStorageCacheSchema>;
