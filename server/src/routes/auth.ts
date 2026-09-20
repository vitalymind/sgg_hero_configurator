import { Router, Request, Response } from 'express';
import { DatabaseSync } from 'node:sqlite';
import crypto from 'crypto';
import {
	LoginSchema,
	SignUpSchema,
	VerifyOtpSchema
} from '@hero_manager/shared';
import {
	MAX_SESSION_AGE_MS,
	maxSessionAge,
	OTP_EXPIRY_MS,
	OTP_COOLDOWN_MS,
	MAX_OTP_ATTEMPTS,
	AUTH_RATE_LIMIT_WINDOW_MS,
	AUTH_RATE_LIMIT_MAX
} from '../constants.js';
import {
	dbGetSession,
	dbDeleteSession,
	dbCreateOrUpdateSession,
	dbSaveOtp,
	dbGetOtp,
	dbDeleteOtp,
	dbIncrementOtpAttempts,
	dbGetUserByEmail,
	dbCreateOrUpdateUser
} from '../database.js';
import { validateRequest } from '../middlewares/validate.js';
import { requireAuth } from '../middlewares/auth.js';
import { createRateLimiter } from '../middlewares/rate_limit.js';
import { EmailService, createEmailService } from '../services/email.js';

export function generateOtp(): string {
	return crypto.randomInt(100000, 1000000).toString();
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
	console.log(`${log}${user !== '' ? ', User email: ' + user : ''}`);
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
			sameSite: 'lax',
			domain: process.env.COOKIE_DOMAIN || undefined,
			maxAge: maxSessionAge
		});
	}
}

export function createAuthRouter(
	db: DatabaseSync,
	emailService: EmailService = createEmailService()
): Router {
	const router = Router();
	const log = (message: string, token: string = "") => writeLog(db, message, token);

	// Per-IP rate limiter for OTP requests (sign-up and login)
	const authIpRateLimiter = createRateLimiter({
		windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
		max: AUTH_RATE_LIMIT_MAX,
		message: 'Too many authentication attempts from this IP. Please try again later.'
	});

	router.get('/connect', requireAuth(db), (_req: Request, res: Response) => {
		return res.status(200).end();
	});

	router.post(
		'/signup',
		authIpRateLimiter,
		validateRequest({ body: SignUpSchema }),
		async (req: Request, res: Response) => {
			const { email, name } = req.body;

			// Per-email 60s cooldown check
			const existingOtp = dbGetOtp(db, email);
			if (existingOtp) {
				const elapsedMs = OTP_EXPIRY_MS - (existingOtp.expires_at - Date.now());
				if (elapsedMs < OTP_COOLDOWN_MS) {
					const waitSec = Math.ceil((OTP_COOLDOWN_MS - elapsedMs) / 1000);
					return res.status(429).json({
						error: 'COOLDOWN_ACTIVE',
						message: `Please wait ${waitSec}s before requesting another verification code.`,
						retryAfter: waitSec
					});
				}
			}

			const otp = generateOtp();
			const expiresAt = Date.now() + OTP_EXPIRY_MS;
			dbSaveOtp(db, email, otp, name, expiresAt);

			log(`[AUTH]: Generating signup OTP for ${email} (${name})`);

			try {
				await emailService.sendOtp(email, otp, { name });
			} catch (error) {
				console.error(`[AUTH]: Failed to deliver OTP to ${email}:`, error);
			}

			// Anti-enumeration: always return 200 generic success message
			return res.status(200).json({ message: "Verification code sent" });
		}
	);

	router.post(
		'/login',
		authIpRateLimiter,
		validateRequest({ body: LoginSchema }),
		async (req: Request, res: Response) => {
			const { email } = req.body;

			// Per-email 60s cooldown check
			const existingOtp = dbGetOtp(db, email);
			if (existingOtp) {
				const elapsedMs = OTP_EXPIRY_MS - (existingOtp.expires_at - Date.now());
				if (elapsedMs < OTP_COOLDOWN_MS) {
					const waitSec = Math.ceil((OTP_COOLDOWN_MS - elapsedMs) / 1000);
					return res.status(429).json({
						error: 'COOLDOWN_ACTIVE',
						message: `Please wait ${waitSec}s before requesting another verification code.`,
						retryAfter: waitSec
					});
				}
			}

			const existingUser = dbGetUserByEmail(db, email);
			const name = existingUser?.name;

			const otp = generateOtp();
			const expiresAt = Date.now() + OTP_EXPIRY_MS;
			dbSaveOtp(db, email, otp, name, expiresAt);

			log(`[AUTH]: Generating login OTP for ${email}`);

			try {
				await emailService.sendOtp(email, otp, { name });
			} catch (error) {
				console.error(`[AUTH]: Failed to deliver OTP to ${email}:`, error);
			}

			// Anti-enumeration: always return 200 generic success message
			return res.status(200).json({ message: "Verification code sent" });
		}
	);

	router.post('/login/verify', validateRequest({ body: VerifyOtpSchema }), (req: Request, res: Response) => {
		const { email, otp } = req.body;

		const storedData = dbGetOtp(db, email);

		if (!storedData || storedData.attempts >= MAX_OTP_ATTEMPTS) {
			log(`[AUTH]: Invalid or locked OTP attempt for ${email}`);
			return res.status(401).json({ error: "INVALID_OTP", message: "Invalid or expired verification code" });
		}

		if (Date.now() > storedData.expires_at) {
			dbDeleteOtp(db, email);
			log(`[AUTH]: Expired OTP verification attempt for ${email}`);
			return res.status(401).json({ error: "EXPIRED_OTP", message: "Verification code has expired" });
		}

		if (storedData.otp !== otp) {
			const attempts = dbIncrementOtpAttempts(db, email);
			log(`[AUTH]: Wrong OTP attempt for ${email} (attempt ${attempts}/${MAX_OTP_ATTEMPTS})`);
			if (attempts >= MAX_OTP_ATTEMPTS) {
				dbDeleteOtp(db, email);
				log(`[AUTH]: Maximum OTP attempts exceeded for ${email}, locked out.`);
			}
			return res.status(401).json({ error: "INVALID_OTP", message: "Invalid verification code" });
		}

		// Valid OTP
		dbDeleteOtp(db, email);

		const emailPrefix = email.split('@')[0] ?? 'User';
		const userName = storedData.name || emailPrefix;
		const user = dbCreateOrUpdateUser(db, email, userName);

		log(`[AUTH]: ${email} successfully authenticated`);

		const sessionToken = crypto.randomUUID();
		dbCreateOrUpdateSession(db, sessionToken, email, Date.now() + maxSessionAge);
		res.cookie('auth_token', sessionToken, {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax',
			domain: process.env.COOKIE_DOMAIN || undefined,
			maxAge: maxSessionAge
		});

		return res.status(200).json({
			message: "Authenticated",
			user: { email: user.email, name: user.name }
		});
	});

	router.post('/logout', (req: Request, res: Response) => {
		const token = req.cookies?.auth_token;
		if (token) {
			dbDeleteSession(db, token);
		}
		res.clearCookie('auth_token', {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax',
			domain: process.env.COOKIE_DOMAIN || undefined
		});
		return res.status(200).json({ message: "Logged out" });
	});

	return router;
}
