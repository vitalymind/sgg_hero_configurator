import { Request, Response, NextFunction } from 'express';
import { DatabaseSync } from 'node:sqlite';
import { isValidSession } from '../routes/auth.js';

export function requireAuth(db: DatabaseSync) {
	return (req: Request, res: Response, next: NextFunction): void => {
		const token = req.cookies?.auth_token;
		if (!token || !isValidSession(db, token, res)) {
			res.status(401).end();
			return;
		}
		res.locals.authToken = token;
		next();
	};
}
