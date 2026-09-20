import { z } from 'zod';
import {
	NAME_REGEX,
	USER_NAME_REGEX,
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
	name: z.string()
		.min(1, 'Name is required')
		.max(MAX_STRING_LENGTH, `Name must not exceed ${MAX_STRING_LENGTH} characters`)
		.regex(NAME_REGEX, 'Name contains invalid characters'),
	special_skill_id: z.string()
		.min(1, 'Skill ID is required')
		.max(MAX_STRING_LENGTH, `Skill ID must not exceed ${MAX_STRING_LENGTH} characters`)
		.regex(SPECIAL_SKILL_ID_REGEX, 'Skill ID contains invalid characters'),
	attack: z.coerce
		.number({ invalid_type_error: 'Attack must be a number' })
		.int('Attack must be an integer')
		.min(MIN_NUMERIC_VALUE, `Attack must be at least ${MIN_NUMERIC_VALUE}`)
		.max(MAX_NUMERIC_VALUE, `Attack must not exceed ${MAX_NUMERIC_VALUE}`),
	defense: z.coerce
		.number({ invalid_type_error: 'Defense must be a number' })
		.int('Defense must be an integer')
		.min(MIN_NUMERIC_VALUE, `Defense must be at least ${MIN_NUMERIC_VALUE}`)
		.max(MAX_NUMERIC_VALUE, `Defense must not exceed ${MAX_NUMERIC_VALUE}`)
});

export const UpdateHeroBodySchema = CreateHeroBodySchema.extend({
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

export const HeroesSyncResponseSchema = z.object({
	lastUpdated: z.number(),
	heroes: z.array(HeroSchema),
	activeUuids: z.array(z.string())
});

export const LocalStorageCacheSchema = z.object({
	lastUpdated: z.number(),
	heroes: z.array(HeroSchema)
});

export const LoginSchema = z.object({
	email: z.string().trim().min(1, 'Email is required').email('Please enter a valid email address')
});

export const SignUpSchema = z.object({
	name: z.string()
		.trim()
		.min(1, 'Name is required')
		.max(MAX_STRING_LENGTH, `Name must not exceed ${MAX_STRING_LENGTH} characters`)
		.regex(USER_NAME_REGEX, 'Name contains invalid characters'),
	email: z.string().trim().min(1, 'Email is required').email('Please enter a valid email address')
});

export const VerifyOtpSchema = z.object({
	email: z.string().trim().min(1, 'Email is required').email('Please enter a valid email address'),
	otp: z.string().trim().regex(/^\d{6}$/, 'OTP must be exactly 6 digits')
});
