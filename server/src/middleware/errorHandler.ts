import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { MulterError } from 'multer';
import jwt from 'jsonwebtoken';
import { AppError } from '@/utils/AppError';
import { logger } from '@/lib/logger';
import { env } from '@/config/env';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(404, `Route ${req.method} ${req.originalUrl} not found`, 'ROUTE_NOT_FOUND'));
};

function zodFieldErrors(err: ZodError) {
  const out: Record<string, string[]> = {};
  for (const issue of err.issues) {
    const key = issue.path.join('.') || '_';
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  let status = 500;
  let message = 'Something went wrong on our side. Please try again.';
  let code = 'INTERNAL_ERROR';
  let errors: Record<string, string[]> | undefined;

  if (err instanceof AppError) {
    status = err.statusCode;
    message = err.message;
    code = err.code ?? code;
    errors = err.errors;
  } else if (err instanceof ZodError) {
    status = 422;
    code = 'VALIDATION_ERROR';
    errors = zodFieldErrors(err);
    message = 'Some fields need attention';
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      status = 409;
      code = 'DUPLICATE';
      const target = (err.meta?.target as string[] | undefined)?.join(', ');
      message = target ? `A record with this ${target} already exists` : 'This record already exists';
    } else if (err.code === 'P2025') {
      status = 404;
      code = 'NOT_FOUND';
      message = 'Record not found';
    } else if (err.code === 'P2003') {
      status = 409;
      code = 'IN_USE';
      message = 'This record is still referenced by other data';
    }
  } else if (err instanceof jwt.TokenExpiredError) {
    status = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Your session expired';
  } else if (err instanceof jwt.JsonWebTokenError) {
    status = 401;
    code = 'INVALID_TOKEN';
    message = 'Invalid session';
  } else if (err instanceof MulterError) {
    status = 400;
    code = err.code;
    message =
      err.code === 'LIMIT_FILE_SIZE' ? `Files must be ${env.UPLOAD_MAX_MB} MB or smaller` : err.message;
  } else if (err?.type === 'entity.parse.failed') {
    status = 400;
    code = 'BAD_JSON';
    message = 'Malformed JSON body';
  }

  if (status >= 500) (req.log ?? logger).error({ err }, 'Unhandled error');

  res.status(status).json({
    success: false,
    data: null,
    message,
    code,
    ...(errors ? { errors } : {}),
    ...(!env.isProd && status >= 500 ? { stack: err?.stack } : {}),
  });
};
