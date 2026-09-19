import { z } from 'zod';
import {
	NAME_REGEX,
	SPECIAL_SKILL_ID_REGEX,
	UUID_REGEX,
	MAX_STRING_LENGTH,
	MIN_NUMERIC_VALUE,
	MAX_NUMERIC_VALUE,
	HERO_STATUSES
} from './constants.js';

export const HeroQuerySchema = z.object({
	lastUpdated: z.coerce.number().int().min(0)
});

export const HeroParamsSchema = z.object({
	uuid: z.string().regex(UUID_REGEX)
});

export const CreateHeroBodySchema = z.object({
	name: z.string().min(1).max(MAX_STRING_LENGTH).regex(NAME_REGEX),
	special_skill_id: z.string().min(1).max(MAX_STRING_LENGTH).regex(SPECIAL_SKILL_ID_REGEX),
	attack: z.coerce.number().int().min(MIN_NUMERIC_VALUE).max(MAX_NUMERIC_VALUE),
	defense: z.coerce.number().int().min(MIN_NUMERIC_VALUE).max(MAX_NUMERIC_VALUE)
});

export const UpdateHeroBodySchema = z.object({
	name: z.string().min(1).max(MAX_STRING_LENGTH).regex(NAME_REGEX),
	special_skill_id: z.string().min(1).max(MAX_STRING_LENGTH).regex(SPECIAL_SKILL_ID_REGEX),
	attack: z.coerce.number().int().min(MIN_NUMERIC_VALUE).max(MAX_NUMERIC_VALUE),
	defense: z.coerce.number().int().min(MIN_NUMERIC_VALUE).max(MAX_NUMERIC_VALUE),
	status: z.enum(HERO_STATUSES)
});

export const HeroSchema = z.object({
	id: z.number().optional(),
	uuid: z.string().regex(UUID_REGEX),
	name: z.string().min(1).max(MAX_STRING_LENGTH).regex(NAME_REGEX),
	special_skill_id: z.string().min(1).max(MAX_STRING_LENGTH).regex(SPECIAL_SKILL_ID_REGEX),
	attack: z.number().int().min(MIN_NUMERIC_VALUE).max(MAX_NUMERIC_VALUE),
	defense: z.number().int().min(MIN_NUMERIC_VALUE).max(MAX_NUMERIC_VALUE),
	status: z.enum(HERO_STATUSES)
});

export const LoginSchema = z.object({
	email: z.string().email()
});

export const VerifyOtpSchema = z.object({
	email: z.string().email(),
	otp: z.string().min(1)
});
