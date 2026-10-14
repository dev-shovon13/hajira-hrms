import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny, z } from 'zod';

interface Schemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

/**
 * Validates and coerces request parts. Parsed output lands on req.valid and
 * replaces req.body, so handlers always see clean data. ZodErrors flow to the
 * central error handler, which turns them into a 422 with field messages.
 */
export const validate =
  (schemas: Schemas) => (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.valid = req.valid ?? {};
      if (schemas.params) req.valid.params = schemas.params.parse(req.params);
      if (schemas.query) req.valid.query = schemas.query.parse(req.query);
      if (schemas.body) {
        req.valid.body = schemas.body.parse(req.body);
        req.body = req.valid.body;
      }
      next();
    } catch (err) {
      next(err);
    }
  };

/** Typed accessors for validated input. */
export const vq = <S extends ZodTypeAny>(req: Request, _schema: S) => req.valid.query as z.infer<S>;
export const vb = <S extends ZodTypeAny>(req: Request, _schema: S) => req.valid.body as z.infer<S>;
