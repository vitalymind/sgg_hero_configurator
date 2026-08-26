import express, { Request, Response } from 'express';
import { DatabaseSync } from 'node:sqlite';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'path';
import crypto from 'crypto';
import { ALLOWED_CORS_DOMAIN, ALLOWED_NAME_CHARACTERS, ALLOWED_SPECIAL_ID_CHARACTERS, ALLOWED_UUID_CHARACTERS, HEARTBEAT_SEND_RATE_SECONDS, SESSION_LENGTH_MINUTES } from './constants.js';
import { dbCreateHero, dbGetHeroesSince, dbGetActiveUuids, dbInitEmpty, dbUpdateHero, getTimeStamp, parseNumber, sanitizeString, generateShortUuid, dbGetSession, dbCreateOrUpdateSession, dbDeleteSession } from './database.js';

//Config
const maxSessionAge = SESSION_LENGTH_MINUTES * 60 * 1000;

//Mockup auth configuration
const whitelistedEmails: string[] = ["user@email.com", "user2@email.com"]

//Init
const app = express();

app.use(cors({
	origin: ALLOWED_CORS_DOMAIN,
	credentials: true
}));

app.use(express.json());
app.use(cookieParser())
const port = process.env.PORT || 3000;
const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/database.sqlite');
const db = new DatabaseSync(dbPath);

//Session handling with http cookie.
function isValidSession(token: string, res: Response): boolean {
	const session = dbGetSession(db, token);

	if (!session) {
		return false;
	}

	if (Date.now() > session.expiresAt) {
		writeLog(`[AUTH]: Session with ${session.email} has expired, re-login required`);
		dbDeleteSession(db, token);
		return false;
	}

	refreshSession(token, res);

	return true;
}

function refreshSession(token: string, res: Response): void {
	const sessionData = dbGetSession(db, token);
	if (sessionData) {
		sessionData.expiresAt = Date.now() + maxSessionAge;
		dbCreateOrUpdateSession(db, token, sessionData.email, sessionData.expiresAt);
		res.cookie('auth_token', token, {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'strict',
			maxAge: maxSessionAge
		});
	}
}

/*
	Simple OTP flow
	This is just a mock up, OTPs should be properly saved just
	as sessions are
*/
const otpStore = new Map<string, { otp: string, expiresAt: number }>();

function generateOtp(): string {
	return "123456";
}

//Logging activity

function writeLog(log: string, token: string = ""): void {
	let user = "";
	if (token !== "") {
		const session = dbGetSession(db, token);
		if (session) {
			user = session.email;
		}
	}
	console.log(`${log}, ${user !== '' ? 'User email: ' + user : ''}`);
}

//Init DB if does not exist
dbInitEmpty(db);

//Auth routes

app.get('/api/connect', (req: Request, res: Response) => {
	const token = req.cookies.auth_token;
	if (token && isValidSession(token, res)) {
		return res.status(200).end();
	}
	return res.status(401).end()
});

app.post('/api/login', (req: Request, res: Response) => {
	const { email } = req.body;
	if (!email || typeof email !== 'string') {
		writeLog(`[AUTH]: login with invalid email ${email}`);
		return res.status(400).end();
	}

	if (whitelistedEmails.includes(email)) {
		//Simple mock-up
		const otp = generateOtp();
		const expiresAt = Date.now() + 5 * 60 * 1000;
		otpStore.set(email, { otp, expiresAt });

		writeLog(`[AUTH]: Sending OTP: ${otp} to ${email}`);
	} else {
		writeLog(`[AUTH]: Login attempt from non-whtelisted email ${email}`);
	}

	return res.status(200).json({ message: "OTP sent successfully" });
});

app.post('/api/login/verify', (req: Request, res: Response) => {
	const { email, otp } = req.body;

	if (!email || !otp) {
		writeLog(`[AUTH]: Data error OTP ${otp} email ${email}`);
		return res.status(401).end();
	}

	writeLog(`[AUTH]: Received OTP ${otp} from ${email}`);

	if (!whitelistedEmails.includes(email)) {
		writeLog(`[AUTH]: ${email} is not whitelisted`);
		return res.status(401).end();
	}

	const storedData = otpStore.get(email);

	if (!storedData) {
		writeLog(`[AUTH]: no OTP entry for email ${email}`);
		return res.status(401).end();
	}

	if (Date.now() > storedData.expiresAt) {
		otpStore.delete(email);
		writeLog(`[AUTH]: OTP for email ${email} has expired`);
		return res.status(401).end();
	}

	if (storedData.otp !== otp) {
		writeLog(`[AUTH]: OTP for email ${email} is wrong ${otp} should have been ${storedData.otp}`);
		return res.status(401).end();
	}

	otpStore.delete(email);

	writeLog(`[AUTH]: email ${email} logged in with ${otp}`);

	const sessionToken = crypto.randomUUID();
	dbCreateOrUpdateSession(db, sessionToken, email, Date.now() + maxSessionAge);
	res.cookie('auth_token', sessionToken, {
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'strict',
		maxAge: maxSessionAge
	});

	return res.status(200).end();
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

app.get('/api/heroes/stream', (req: Request, res: Response) => {
	const token = req.cookies.auth_token;
	if (!token || !isValidSession(token, res)) {
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
app.get('/api/heroes', (req: Request, res: Response) => {
	const token = req.cookies.auth_token;
	if (!token || !isValidSession(token, res)) {
		return res.status(401).end()
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
		writeLog(`[DB]: Fetching ${heroes.length} hero entries, updated since ${lastUpdated} `, token);
		return res.status(200).json({
			lastUpdated: getTimeStamp(),
			heroes: heroes,
			activeUuids: activeUuids
		});
	} catch (error) {
		writeLog(`[DB]: Error fetching heroes: ${error}`, token);
		return res.status(500).end();
	}
});

app.post('/api/heroes', (req: Request, res: Response) => {
	const token = req.cookies.auth_token;
	if (!token || !isValidSession(token, res)) {
		return res.status(401).end();
	}

	const name = sanitizeString(req.body.name, ALLOWED_NAME_CHARACTERS);
	const specialSkillId = sanitizeString(req.body.special_skill_id, ALLOWED_SPECIAL_ID_CHARACTERS);
	const attack = parseNumber(req.body.attack);
	const defense = parseNumber(req.body.defense);

	if (!name || !specialSkillId || attack === null || defense === null) {
		writeLog(`[DB]: Validation failed for POST /api/heroes`, token);
		return res.status(422).end();
	}

	try {
		const heroUuid = generateShortUuid();
		const newHero = dbCreateHero(db, heroUuid, name, attack, defense, specialSkillId);
		writeLog(`[DB]: Creating hero ${name} data with uuid ${heroUuid}`, token);
		notifyClients();
		return res.status(200).json(newHero);
	} catch (error) {
		writeLog(`[DB]: Error creating hero: ${error}`, token);
		return res.status(500).end();
	}
});

app.put('/api/heroes/:uuid', (req: Request, res: Response) => {
	const token = req.cookies.auth_token;
	if (!token || !isValidSession(token, res)) {
		return res.status(401).end()
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
		writeLog(`[DB]: Validation failed for PUT /api/heroes/:uuid (status)`, token);
		return res.status(400).end();
	}

	if (!name || !specialSkillId || attack === null || defense === null) {
		writeLog(`[DB]: Validation failed for PUT /api/heroes/:uuid (data)`, token);
		return res.status(422).end();
	}

	try {
		const updatedHero = dbUpdateHero(db, uuid, name, attack, defense, specialSkillId, status);
		if (!updatedHero) {
			writeLog(`[DB]: Failed to update hero ${name} data with uuid ${uuid}. Reason: Failed to find hero entry.`, token);
			return res.status(404).end();
		};
		writeLog(`[DB]: Updating hero ${name} data with uuid ${uuid}`, token);
		notifyClients();
		return res.status(200).json(updatedHero);
	} catch (error) {
		writeLog(`[DB]: Error updating hero: ${error}`, token);
		return res.status(500).end();
	}
});

//Start listening

app.listen(port, () => {
	console.log(`Server is running at http://localhost:${port}`);
});