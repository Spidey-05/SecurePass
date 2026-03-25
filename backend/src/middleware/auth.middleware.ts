import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { verifyAccessToken } from '../utils/jwt';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { env } from '../config/env';

// ─── Auth Middleware ───────────────────────────────────────────────────────────

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; email: string };
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next(AppError.unauthorized('No access token provided'));
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    next(AppError.unauthorized('Invalid or expired access token'));
  }
}

// ─── Zod Validation Middleware ─────────────────────────────────────────────────

export function validate(schema: AnyZodObject) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
        cookies: req.cookies,
      });

      // Inject parsed values back to prevent prototype pollution
      req.body = parsed.body ?? req.body;
      req.query = parsed.query ?? req.query;
      req.params = parsed.params ?? req.params;

      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const errors = err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        next(
          new AppError(
            'Validation failed',
            400,
            'VALIDATION_ERROR',
            true
          )
        );
        // attach errors to the response without extra overhead
        (next as unknown as Function)(
          Object.assign(new AppError('Validation failed', 400, 'VALIDATION_ERROR'), {
            validationErrors: errors,
          })
        );
        return;
      }
      next(err);
    }
  };
}

// Better validate — avoids double-next issue
export function validateRequest(schema: AnyZodObject) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
        cookies: req.cookies,
      });
      if (parsed.body !== undefined) req.body = parsed.body;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: err.errors.map((e) => ({
              field: e.path.slice(1).join('.'),
              message: e.message,
            })),
          },
        });
        return;
      }
      next(err);
    }
  };
}

// ─── Global Error Handler ──────────────────────────────────────────────────────

export function globalErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred';
  let validationErrors: unknown[] | undefined;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code ?? 'ERROR';
    message = err.message;
    validationErrors = (err as AppError & { validationErrors?: unknown[] }).validationErrors;
  }

  // Log server errors
  if (statusCode >= 500) {
    logger.error('Server error:', {
      message: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
    });
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message: env.NODE_ENV === 'production' && statusCode >= 500
        ? 'Internal server error'
        : message,
      ...(validationErrors && { details: validationErrors }),
    },
  });
}

// ─── Not Found Handler ─────────────────────────────────────────────────────────

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(AppError.notFound(`Route ${req.method} ${req.path} not found`));
}
