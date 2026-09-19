import { Router, Request, Response } from 'express';
import { DatabaseSync } from 'node:sqlite';
import { ALLOWED_NAME_CHARACTERS, ALLOWED_SPECIAL_ID_CHARACTERS, ALLOWED_UUID_CHARACTERS, HEARTBEAT_SEND_RATE_SECONDS } from '../constants.js';
import { dbCreateHero, dbGetHeroesSince, dbGetActiveUuids, dbUpdateHero, getTimeStamp, parseNumber, sanitizeString, generateShortUuid } from '../database.js';
import { isValidSession, writeLog } from './auth.js';

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
	const log = (message: string, token: string = "") => writeLog(db, message, token);
	const validateSession = (token: string, res: Response) => isValidSession(db, token, res);

	router.get('/stream', (req: Request, res: Response) => {
		const token = req.cookies.auth_token;
		if (!token || !validateSession(token, res)) {
			return res.status(401).end();
		}
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
	router.get('/', (req: Request, res: Response) => {
		const token = req.cookies.auth_token;
		if (!token || !validateSession(token, res)) {
			return res.status(401).end();
		}

		if (req.query.lastUpdated === null || req.query.lastUpdated === undefined) {
			return res.status(400).end();
		}

		const lastUpdated = Number(req.query.lastUpdated);

		if (isNaN(lastUpdated)) {
			return res.status(400).end();
		}

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

	router.post('/', (req: Request, res: Response) => {
		const token = req.cookies.auth_token;
		if (!token || !validateSession(token, res)) {
			return res.status(401).end();
		}

		const name = sanitizeString(req.body.name, ALLOWED_NAME_CHARACTERS);
		const specialSkillId = sanitizeString(req.body.special_skill_id, ALLOWED_SPECIAL_ID_CHARACTERS);
		const attack = parseNumber(req.body.attack);
		const defense = parseNumber(req.body.defense);

		if (!name || !specialSkillId || attack === null || defense === null) {
			log(`[DB]: Validation failed for POST /api/heroes`, token);
			return res.status(422).end();
		}

		try {
			const heroUuid = generateShortUuid();
			const newHero = dbCreateHero(db, heroUuid, name, attack, defense, specialSkillId);
			log(`[DB]: Creating hero ${name} data with uuid ${heroUuid}`, token);
			notifyClients();
			return res.status(200).json(newHero);
		} catch (error) {
			log(`[DB]: Error creating hero: ${error}`, token);
			return res.status(500).end();
		}
	});

	router.put('/:uuid', (req: Request, res: Response) => {
		const token = req.cookies.auth_token;
		if (!token || !validateSession(token, res)) {
			return res.status(401).end();
		}

		const uuid = sanitizeString(req.params.uuid, ALLOWED_UUID_CHARACTERS);
		if (uuid === null) {
			return res.status(400).end();
		}

		const name = sanitizeString(req.body.name, ALLOWED_NAME_CHARACTERS);
		const specialSkillId = sanitizeString(req.body.special_skill_id, ALLOWED_SPECIAL_ID_CHARACTERS);
		const attack = parseNumber(req.body.attack);
		const defense = parseNumber(req.body.defense);
		const status = req.body.status;

		if (status !== 'active' && status !== 'deleted') {
			log(`[DB]: Validation failed for PUT /api/heroes/:uuid (status)`, token);
			return res.status(400).end();
		}

		if (!name || !specialSkillId || attack === null || defense === null) {
			log(`[DB]: Validation failed for PUT /api/heroes/:uuid (data)`, token);
			return res.status(422).end();
		}

		try {
			const updatedHero = dbUpdateHero(db, uuid, name, attack, defense, specialSkillId, status);
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
