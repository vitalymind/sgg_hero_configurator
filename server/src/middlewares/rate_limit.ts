import { Request, Response, NextFunction } from 'express';

export interface RateLimiterOptions {
	windowMs: number;
	max: number;
	message?: string;
}

interface RateLimitEntry {
	count: number;
	resetTime: number;
}

/**
 * Extracts the real client IP address from the incoming request.
 * Handles single/multiple X-Forwarded-For headers when behind reverse proxies (like NGINX),
 * falls back to the underlying TCP socket address.
 */
function extractClientIp(req: Request): string {
	const forwardedHeader = req.headers['x-forwarded-for'];

	if (typeof forwardedHeader === 'string') {
		const parts = forwardedHeader.split(',');
		const firstPart = parts[0];
		if (firstPart !== undefined) {
			const trimmedIp = firstPart.trim();
			if (trimmedIp.length > 0) {
				return trimmedIp;
			}
		}
	} else if (Array.isArray(forwardedHeader)) {
		const firstHeader = forwardedHeader[0];
		if (firstHeader !== undefined) {
			const parts = firstHeader.split(',');
			const firstPart = parts[0];
			if (firstPart !== undefined) {
				const trimmedIp = firstPart.trim();
				if (trimmedIp.length > 0) {
					return trimmedIp;
				}
			}
		}
	}

	if (req.socket.remoteAddress) {
		return req.socket.remoteAddress;
	}

	return 'unknown';
}

/**
 * Lightweight, zero-dependency in-memory rate limiter middleware for Express.
 * Tracks request counts per client IP within a sliding window.
 */
export function createRateLimiter(options: RateLimiterOptions) {
	const clients = new Map<string, RateLimitEntry>();

	// Periodically purge expired records to prevent memory leaks
	const cleanupInterval = setInterval(() => {
		const now = Date.now();
		for (const [key, entry] of clients.entries()) {
			if (now > entry.resetTime) {
				clients.delete(key);
			}
		}
	}, 60 * 1000);

	// Unref so this timer never blocks Node process shutdown or tests
	cleanupInterval.unref();

	return (req: Request, res: Response, next: NextFunction): void => {
		const clientIp = extractClientIp(req);
		const currentTime = Date.now();
		let entry = clients.get(clientIp);

		// Initialize or reset if window has expired
		if (!entry || currentTime > entry.resetTime) {
			entry = {
				count: 1,
				resetTime: currentTime + options.windowMs
			};
			clients.set(clientIp, entry);
			next();
			return;
		}

		// Check if request limit has been reached
		if (entry.count >= options.max) {
			const secondsUntilReset = Math.ceil((entry.resetTime - currentTime) / 1000);
			res.setHeader('Retry-After', secondsUntilReset);

			const errorMessage =
				options.message || 'Too many requests from this IP. Please try again later.';

			res.status(429).json({
				error: 'RATE_LIMIT_EXCEEDED',
				message: errorMessage,
				retryAfter: secondsUntilReset
			});
			return;
		}

		// Increment and proceed
		entry.count++;
		next();
	};
}
