import { Router, Request, Response } from 'express';
import { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import {
	NAME_REGEX,
	SPECIAL_SKILL_ID_REGEX,
	UUID_REGEX,
	MAX_STRING_LENGTH,
	MIN_NUMERIC_VALUE,
	MAX_NUMERIC_VALUE,
	HEARTBEAT_SEND_RATE_SECONDS
} from '../constants.js';
import {
	dbCreateHero,
	dbGetHeroesSince,
	dbGetActiveUuids,
	dbUpdateHero,
	getTimeStamp,
	generateShortHeroId
} from '../database.js';
import { writeLog } from './auth.js';
import { requireAuth } from '../middlewares/auth.js';
import { validateRequest } from '../middlewares/validate.js';

// Schemas
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
	status: z.enum(['active', 'deleted'])
});

// Heartbeat and outside updates

const sseClients = new Set<Response>();

function notifyClients() {
	for (const client of sseClients) {
		client.write('data: update\n\n');
	}
}

setInterval(() => {
	for (const client of sseClients) {
		client.write('data: ping\n\n');
	}
}, HEARTBEAT_SEND_RATE_SECONDS * 1000);

export function createHeroesRouter(db: DatabaseSync): Router {
	const router = Router();
	router.use(requireAuth(db));

	const log = (message: string, token: string = "") => writeLog(db, message, token);

	router.get('/stream', (req: Request, res: Response) => {
		res.setHeader('Content-Type', 'text/event-stream');
		res.setHeader('Cache-Control', 'no-cache');
		res.setHeader('Connection', 'keep-alive');
		res.flushHeaders();

		sseClients.add(res);

		req.on('close', () => {
			sseClients.delete(res);
		});
	});

	// DB routes
	router.get('/', validateRequest({ query: HeroQuerySchema }), (req: Request, res: Response) => {
		const token = res.locals.authToken as string;
		const lastUpdated = Number(req.query.lastUpdated);

		try {
			const heroes = dbGetHeroesSince(db, lastUpdated);
			const activeUuids = dbGetActiveUuids(db);
			log(`[DB]: Fetching ${heroes.length} hero entries, updated since ${lastUpdated} `, token);
			return res.status(200).json({
				lastUpdated: getTimeStamp(),
				heroes: heroes,
				activeUuids: activeUuids
			});
		} catch (error) {
			log(`[DB]: Error fetching heroes: ${error}`, token);
			return res.status(500).end();
		}
	});

	router.post('/', validateRequest({ body: CreateHeroBodySchema }), (req: Request, res: Response) => {
		const token = res.locals.authToken as string;
		const { name, special_skill_id, attack, defense } = req.body;

		try {
			const heroUuid = generateShortHeroId();
			const newHero = dbCreateHero(db, heroUuid, name, attack, defense, special_skill_id);
			log(`[DB]: Creating hero ${name} data with uuid ${heroUuid}`, token);
			notifyClients();
			return res.status(200).json(newHero);
		} catch (error) {
			log(`[DB]: Error creating hero: ${error}`, token);
			return res.status(500).end();
		}
	});

	router.put('/:uuid', validateRequest({ params: HeroParamsSchema, body: UpdateHeroBodySchema }), (req: Request, res: Response) => {
		const token = res.locals.authToken as string;
		const uuid = req.params.uuid as string;
		const { name, special_skill_id, attack, defense, status } = req.body;

		try {
			const updatedHero = dbUpdateHero(db, uuid, name, attack, defense, special_skill_id, status);
			if (!updatedHero) {
				log(`[DB]: Failed to update hero ${name} data with uuid ${uuid}. Reason: Failed to find hero entry.`, token);
				return res.status(404).end();
			}
			log(`[DB]: Updating hero ${name} data with uuid ${uuid}`, token);
			notifyClients();
			return res.status(200).json(updatedHero);
		} catch (error) {
			log(`[DB]: Error updating hero: ${error}`, token);
			return res.status(500).end();
		}
	});

	return router;
}
