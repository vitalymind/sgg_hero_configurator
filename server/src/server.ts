import express, { Request, Response } from 'express';
import { DatabaseSync } from 'node:sqlite';
import cookieParser from 'cookie-parser';
import path from 'path';
import crypto from 'crypto';
import { ALLOWED_NAME_CHARACTERS, ALLOWED_SPECIAL_ID_CHARACTERS } from './constants';
import { dbCreateHero, dbGetHeroesSince, dbInitEmpty, dbUpdateHero, getTimeStamp, parseNumber, sanitizeString } from './database';

//Config
const whitelistedEmails: String[] = ["user@email.com"]
const maxSessionAge = 10 * 60 * 1000;

//Init
const app = express();
app.use(express.json());
app.use(cookieParser())
const port = process.env.PORT || 3000;
const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/database.sqlite');
const db = new DatabaseSync(dbPath);

//Simple session handling with http cookie

const activeSessions = new Map<string, { email: string, expiresAt: number }>();

function isValidSession(token: string): boolean {
	const session = activeSessions.get(token);

	if (!session) {
		return false;
	}

	if (Date.now() > session.expiresAt) {
		writeLog(`[AUTH]: Session with ${session.email} has expired, re-login requierd`);
		activeSessions.delete(token);
		return false;
	}

	refreshSession(token);

	return true;
}

function refreshSession(token: string): void {
	const sessionData = activeSessions.get(token);
	if (sessionData) {
		sessionData.expiresAt = Date.now() + maxSessionAge;
	}
}

//Mocking simple OTP flow

const otpStore = new Map<string, { otp: string, expiresAt: number }>();

//Logging activity

function writeLog(log: String, token: string = ""): void {
	var user = "";
	if (token !== "") {
		const session = activeSessions.get(token);
		if (session) {user = session.email}
	}
	console.log(`${log}, ${user == '' ? 'User email: ' + user : ''}`);
}

//Init DB if does not exist
dbInitEmpty(db)

//Auth routes

app.get('/api/connect', (req: Request, res: Response) => {
	const token = req.cookies.auth_token;
	if (token && isValidSession(token)) {
		return res.status(200).end();
	}
  return res.status(401).end()
});

app.post('/api/login', (req: Request, res: Response) => {
	const { email } = req.body;
	if (!email || typeof email !== 'string') {
		writeLog(`[AUTH]: login with invalid email ${email}`);
		return res.status(400).json({ error: "Valid email is required" });
	}

	if (whitelistedEmails.includes(email)) {
		//Simple mock-up
		const otp = "123456";
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
	activeSessions.set(sessionToken, {
		email: email,
		expiresAt: Date.now() + maxSessionAge
	});
	res.cookie('auth_token', sessionToken, {
		httpOnly: true, 
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'strict',
		maxAge: maxSessionAge
	});

	return res.status(200).end();
});


// DB routes
app.get('/api/heroes', (req: Request, res: Response) => {
	const token = req.cookies.auth_token;
	if (!token || !isValidSession(token)) {
		return res.status(401).end()
	};

	const lastUpdated = parseNumber(req.query.lastUpdated);
	
	if (lastUpdated === null) {
		return res.status(400).end();
	}

	try {
		const heroes = dbGetHeroesSince(db, lastUpdated);
		return res.status(200).json({
			lastUpdated: getTimeStamp(),
			heroes: heroes
		});
	} catch (error) {
		writeLog(`[DB]: Error fetching heroes: ${error}`, token);
		return res.status(500).end();
	}
});

app.post('/api/heroes', (req: Request, res: Response) => {
	const token = req.cookies.auth_token;
	if (!token || !isValidSession(token)) {
		return res.status(401).end();
	}

	const name = sanitizeString(req.body.name, ALLOWED_NAME_CHARACTERS);
	const specialSkillId = sanitizeString(req.body.specialSkillId, ALLOWED_SPECIAL_ID_CHARACTERS);
	const attack = parseNumber(req.body.attack);
	const defense = parseNumber(req.body.defense);
	
	if (!name || !specialSkillId || attack === null || defense === null) {
		writeLog(`[DB]: Validation failed for POST /api/heroes`, token);
		return res.status(400).json({ error: "Invalid hero data" });
	}

	try {
		const newHero = dbCreateHero(db, name, attack, defense, specialSkillId);
		return res.status(200).json(newHero);
	} catch (error) {
		writeLog(`[DB]: Error creating hero: ${error}`, token);
		return res.status(500).end();
	}
});

app.put('/api/heroes/:id', (req: Request, res: Response) => {
	const token = req.cookies.auth_token;
	if (!token || !isValidSession(token)) {
		return res.status(401).end()
	};

	const id = parseNumber(req.params.id);
	if (id === null) {
		return res.status(400).json({ error: "Invalid ID parameter" })
	};

	const name = sanitizeString(req.body.name, ALLOWED_NAME_CHARACTERS);
	const specialSkillId = sanitizeString(req.body.specialSkillId, ALLOWED_SPECIAL_ID_CHARACTERS);
	const attack = parseNumber(req.body.attack);
	const defense = parseNumber(req.body.defense);
	const status = req.body.status;
	
	if (status !== 'active' && status !== 'deleted') {
		writeLog(`[DB]: Validation failed for PUT /api/heroes/:id (status)`, token);
		return res.status(400).json({ error: "Invalid status parameter" });
	}

	if (!name || !specialSkillId || attack === null || defense === null) {
		writeLog(`[DB]: Validation failed for PUT /api/heroes/:id (data)`, token);
		return res.status(400).json({ error: "Invalid hero data" });
	}

	try {
		const updatedHero = dbUpdateHero(db, id, name, attack, defense, specialSkillId, status);
		if (!updatedHero) {
			return res.status(404).json({ error: "Hero not found" })
		};
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