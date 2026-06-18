import express, { Request, Response } from 'express';
import { DatabaseSync } from 'node:sqlite';
import cookieParser from 'cookie-parser';
import path from 'path';
import crypto from 'crypto';

//Config
const whitelistedEmails: String[] = ["user@email.com"]
const maxTokenAge = 10 * 60 * 1000;

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
		activeSessions.delete(token);
		return false;
	}

	refreshSession(token);

	return true;
}

function refreshSession(token: string): void {
	const sessionData = activeSessions.get(token);
	if (sessionData) {
		sessionData.expiresAt = Date.now() + maxTokenAge;
	}
}

//Mocking simple OTP flow

const otpStore = new Map<string, { otp: string, expiresAt: number }>();

//Logging activity

function writeLog(log: String): void {
	console.log(log);
}

//Init Database

db.exec(`
  CREATE TABLE IF NOT EXISTS heroes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    special_skill TEXT NOT NULL,
		attack INTEGER,
		defence INTEGER
  )
`);

//Routes

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
		expiresAt: Date.now() + maxTokenAge
	});
	res.cookie('auth_token', sessionToken, {
		httpOnly: true, 
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'strict',
		maxAge: maxTokenAge
	});

	return res.status(200).end();
});

//Start listening

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});