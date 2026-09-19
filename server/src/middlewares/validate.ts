import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export interface RequestValidationSchemas {
	body?: ZodSchema;
	query?: ZodSchema;
	params?: ZodSchema;
}

export function validateRequest(schemas: RequestValidationSchemas) {
	return (req: Request, res: Response, next: NextFunction): void => {
		try {
			if (schemas.body) {
				schemas.body.parse(req.body);
			}
			if (schemas.query) {
				schemas.query.parse(req.query);
			}
			if (schemas.params) {
				schemas.params.parse(req.params);
			}
			next();
		} catch (error) {
			if (error instanceof ZodError) {
				res.status(422).json({
					message: 'Validation failed',
					errors: error.flatten().fieldErrors
				});
				return;
			}
			console.error('[VALIDATION_ERROR]:', error);
			res.status(400).end();
			return;
		}
	};
}
