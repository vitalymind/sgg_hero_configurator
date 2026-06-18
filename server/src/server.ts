import express, { Request, Response } from 'express';
import { DatabaseSync } from 'node:sqlite';
import cookieParser from 'cookie-parser';
import path from 'path';
import crypto from 'crypto';
import { ALLOWED_NAME_CHARACTERS, ALLOWED_SPECIAL_ID_CHARACTERS, ALLOWED_UUID_CHARACTERS } from './constants.js';
import { dbCreateHero, dbGetHeroesSince, dbInitEmpty, dbUpdateHero, getTimeStamp, parseNumber, sanitizeString } from './database.js';

//Config
const whitelistedEmails: string[] = ["user@email.com"]
const maxSessionAge = 10 * 60 * 1000;

//Init
const app = express();
app.use(express.json());
app.use(cookieParser())
const port = process.env.PORT || 3000;
const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/database.sqlite');
const db = new DatabaseSync(dbPath);

//Helpers
function generateShortUuid(): string {
	const timePart = Date.now().toString(36);
	const randomPart = crypto.randomBytes(4).toString('hex');
	 const rawId = timePart + randomPart;
	 return rawId.match(/.{1,4}/g)?.join('-') || rawId;
}

//Simple session handling with http cookie

const activeSessions = new Map<string, { email: string, expiresAt: number }>();

function isValidSession(token: string): boolean {
	const session = activeSessions.get(token);

	if (!session) {
		return false;
	}

	if (Date.now() > session.expiresAt) {
		writeLog(`[AUTH]: Session with ${session.email} has expired, re-login required`);
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

function writeLog(log: string, token: string = ""): void {
	var user = "";
	if (token !== "") {
		const session = activeSessions.get(token);
		if (session) {user = session.email}
	}
	console.log(`${log}, ${user !== '' ? 'User email: ' + user : ''}`);
}

//Init DB if does not exist
dbInitEmpty(db);

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
		return res.status(400).end();
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

	const lastUpdated = Number(req.query.lastUpdated);

	if (isNaN(lastUpdated)) {
		return res.status(400).end();
	}
	
	if (lastUpdated === null) {
		return res.status(400).end();
	}

	try {
		const heroes = dbGetHeroesSince(db, lastUpdated);
		writeLog(`[DB]: Fetching ${heroes.length} hero entries, updated since ${lastUpdated} `, token);
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
		return res.status(200).json(newHero);
	} catch (error) {
		writeLog(`[DB]: Error creating hero: ${error}`, token);
		return res.status(500).end();
	}
});

app.put('/api/heroes/:uuid', (req: Request, res: Response) => {
	const token = req.cookies.auth_token;
	if (!token || !isValidSession(token)) {
		return res.status(401).end()
	};

	const uuid = sanitizeString(req.params.uuid, ALLOWED_UUID_CHARACTERS);
	if (uuid === null) {
		return res.status(400).end();
	};

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

//Debug
function debugTestFillDatabase(): void {
	const initialHeroes = [
		{ name: "Lianna", attack: 95, defense: 75, special_skill_id: "perfect_shot" },
		{ name: "Richard", attack: 75, defense: 95, special_skill_id: "frost_strike" },
		{ name: "Vivica", attack: 65, defense: 90, special_skill_id: "healing_light" },
		{ name: "Elena", attack: 90, defense: 70, special_skill_id: "blade_storm" },
		{ name: "Sartana", attack: 85, defense: 80, special_skill_id: "death_strike" },
		{ name: "Gravemaker", attack: 85, defense: 85, special_skill_id: "burn" },
		{ name: "Telluria", attack: 60, defense: 98, special_skill_id: "force_of_forest" },
		{ name: "Vela", attack: 85, defense: 75, special_skill_id: "water_damage" },
		{ name: "Joon", attack: 95, defense: 60, special_skill_id: "solar_beam" },
		{ name: "Magni", attack: 92, defense: 65, special_skill_id: "sniper_strike" },
		{ name: "Marjana", attack: 85, defense: 75, special_skill_id: "magma_blast" },
		{ name: "Isarnia", attack: 88, defense: 68, special_skill_id: "glacial_shatter" },
		{ name: "Kadilen", attack: 75, defense: 85, special_skill_id: "shield_of_nature" },
		{ name: "Elkanen", attack: 78, defense: 82, special_skill_id: "life_drain" },
		{ name: "Azlar", attack: 90, defense: 60, special_skill_id: "volcano_eruption" },
		{ name: "Quintus", attack: 85, defense: 65, special_skill_id: "lightning_strike" },
		{ name: "Domitia", attack: 80, defense: 80, special_skill_id: "shadow_strike" },
		{ name: "Leonidas", attack: 82, defense: 78, special_skill_id: "holy_light" },
		{ name: "Obakan", attack: 85, defense: 70, special_skill_id: "counter_attack" },
		{ name: "Horghall", attack: 65, defense: 95, special_skill_id: "tree_smash" },
		{ name: "Thorne", attack: 70, defense: 90, special_skill_id: "ice_cleave" },
		{ name: "Justice", attack: 65, defense: 95, special_skill_id: "blinding_light" },
		{ name: "Khagan", attack: 75, defense: 85, special_skill_id: "khan_command" },
		{ name: "Heimdall", attack: 65, defense: 98, special_skill_id: "horn_of_giallar" },
		{ name: "Alfrike", attack: 85, defense: 88, special_skill_id: "mindless_attack" },
		{ name: "Bera", attack: 75, defense: 85, special_skill_id: "moth_swarm" },
		{ name: "Freya", attack: 70, defense: 90, special_skill_id: "raven_flock" },
		{ name: "Frigg", attack: 85, defense: 80, special_skill_id: "nature_defense_down" },
		{ name: "Odin", attack: 88, defense: 75, special_skill_id: "holy_damage" },
		{ name: "Finley", attack: 92, defense: 70, special_skill_id: "chain_strike" },
		{ name: "Killhare", attack: 95, defense: 65, special_skill_id: "reckless_swing" },
		{ name: "Jabberwock", attack: 88, defense: 75, special_skill_id: "double_strike" },
		{ name: "Seshat", attack: 85, defense: 75, special_skill_id: "replicating_minion" },
		{ name: "Black Knight", attack: 60, defense: 99, special_skill_id: "taunt" },
		{ name: "Krampus", attack: 65, defense: 95, special_skill_id: "frost_taunt" }
	];
	for (const hero of initialHeroes) {
		const heroUuid = generateShortUuid();
		dbCreateHero(db, heroUuid, hero.name, hero.attack, hero.defense, hero.special_skill_id);
	}
}
//debugTestFillDatabase();