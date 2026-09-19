import { Router, Request, Response } from 'express';
import { DatabaseSync } from 'node:sqlite';
import crypto from 'crypto';
import { SESSION_LENGTH_MINUTES, LoginSchema, VerifyOtpSchema } from '@hero_manager/shared';
import { dbGetSession, dbDeleteSession, dbCreateOrUpdateSession } from '../database.js';
import { validateRequest } from '../middlewares/validate.js';
import { requireAuth } from '../middlewares/auth.js';

// Config
const maxSessionAge = SESSION_LENGTH_MINUTES * 60 * 1000;

// Mockup auth configuration
const whitelistedEmails: string[] = ["user@email.com", "user2@email.com"];

/*
	Simple OTP flow
	This is just a mock up, OTPs should be properly saved just
	as sessions are
*/
const otpStore = new Map<string, { otp: string; expiresAt: number }>();

function generateOtp(): string {
	return "123456";
}

// Logging activity
export function writeLog(db: DatabaseSync, log: string, token: string = ""): void {
	let user = "";
	if (token !== "") {
		const session = dbGetSession(db, token);
		if (session) {
			user = session.email;
		}
	}
	console.log(`${log}, ${user !== '' ? 'User email: ' + user : ''}`);
}

// Session handling with http cookie
export function isValidSession(db: DatabaseSync, token: string, res: Response): boolean {
	const session = dbGetSession(db, token);

	if (!session) {
		return false;
	}

	if (Date.now() > session.expiresAt) {
		writeLog(db, `[AUTH]: Session with ${session.email} has expired, re-login required`);
		dbDeleteSession(db, token);
		return false;
	}

	refreshSession(db, token, res);

	return true;
}

export function refreshSession(db: DatabaseSync, token: string, res: Response): void {
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

export function createAuthRouter(db: DatabaseSync): Router {
	const router = Router();
	const log = (message: string, token: string = "") => writeLog(db, message, token);

	router.get('/connect', requireAuth(db), (_req: Request, res: Response) => {
		return res.status(200).end();
	});

	router.post('/login', validateRequest({ body: LoginSchema }), (req: Request, res: Response) => {
		const { email } = req.body;

		if (whitelistedEmails.includes(email)) {
			// Simple mock-up
			const otp = generateOtp();
			const expiresAt = Date.now() + 5 * 60 * 1000;
			otpStore.set(email, { otp, expiresAt });

			log(`[AUTH]: Sending OTP: ${otp} to ${email}`);
		} else {
			log(`[AUTH]: Login attempt from non-whtelisted email ${email}`);
		}

		return res.status(200).json({ message: "OTP sent successfully" });
	});

	router.post('/login/verify', validateRequest({ body: VerifyOtpSchema }), (req: Request, res: Response) => {
		const { email, otp } = req.body;

		log(`[AUTH]: Received OTP ${otp} from ${email}`);

		if (!whitelistedEmails.includes(email)) {
			log(`[AUTH]: ${email} is not whitelisted`);
			return res.status(401).end();
		}

		const storedData = otpStore.get(email);

		if (!storedData) {
			log(`[AUTH]: no OTP entry for email ${email}`);
			return res.status(401).end();
		}

		if (Date.now() > storedData.expiresAt) {
			otpStore.delete(email);
			log(`[AUTH]: OTP for email ${email} has expired`);
			return res.status(401).end();
		}

		if (storedData.otp !== otp) {
			log(`[AUTH]: OTP for email ${email} is wrong ${otp} should have been ${storedData.otp}`);
			return res.status(401).end();
		}

		otpStore.delete(email);

		log(`[AUTH]: email ${email} logged in with ${otp}`);

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

	return router;
}
