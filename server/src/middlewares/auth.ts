import { Request, Response, NextFunction } from 'express';
import { DatabaseSync } from 'node:sqlite';
import { MAX_SESSION_AGE_MS } from '../constants.js';
import {
	dbGetSession,
	dbDeleteSession,
	dbCreateOrUpdateSession,
	dbGetUserByEmail
} from '../database.js';

export interface AuthenticatedUser {
	email: string;
	name: string;
}

export function requireAuth(db: DatabaseSync) {
	return (req: Request, res: Response, next: NextFunction): void => {
		const token = req.cookies?.auth_token;
		if (!token) {
			res.status(401).end();
			return;
		}

		const session = dbGetSession(db, token);
		if (!session) {
			res.status(401).end();
			return;
		}

		if (Date.now() > session.expiresAt) {
			console.log(`[AUTH]: Session with ${session.email} has expired, re-login required`);
			dbDeleteSession(db, token);
			res.clearCookie('auth_token', {
				httpOnly: true,
				secure: process.env.NODE_ENV === 'production',
				sameSite: 'lax',
				domain: process.env.COOKIE_DOMAIN || undefined
			});
			res.status(401).end();
			return;
		}

		// Refresh session sliding window
		const newExpiresAt = Date.now() + MAX_SESSION_AGE_MS;
		dbCreateOrUpdateSession(db, token, session.email, newExpiresAt);
		res.cookie('auth_token', token, {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax',
			domain: process.env.COOKIE_DOMAIN || undefined,
			maxAge: MAX_SESSION_AGE_MS
		});

		// Resolve user details
		const dbUser = dbGetUserByEmail(db, session.email);
		const name = dbUser?.name ?? session.email.split('@')[0] ?? 'User';

		res.locals.authToken = token;
		res.locals.user = { email: session.email, name } satisfies AuthenticatedUser;
		next();
	};
}
