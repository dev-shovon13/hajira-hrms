import path from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';
import { UPLOAD_DIR } from '@/lib/upload';
import { apiLimiter } from '@/middleware/rateLimit';
import { errorHandler, notFoundHandler } from '@/middleware/errorHandler';
import { apiRouter } from '@/routes';
import { buildOpenApiDocument } from '@/docs/openapi';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  if (env.TRUST_PROXY) app.set('trust proxy', 1);

  app.use(
    helmet({
      // Swagger UI needs inline styles/scripts on /api/docs only.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || env.corsOrigins.includes(origin)),
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(cookieParser());
  app.use(hpp());
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === '/health' || req.url?.startsWith('/api/docs') === true },
      customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
      serializers: {
        req: (req) => ({ method: req.method, url: req.url }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    }),
  );

  app.get('/health', (_req, res) => {
    res.json({ success: true, data: { status: 'ok', time: new Date().toISOString() }, message: 'OK' });
  });

  // Locally stored uploads (when Cloudinary is not configured). Long cache: names are content-unique.
  app.use(
    '/uploads',
    express.static(path.resolve(UPLOAD_DIR), {
      maxAge: '30d',
      immutable: true,
      setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
    }),
  );

  const openApi = buildOpenApiDocument();
  app.get('/api/docs.json', (_req, res) => {
    res.json(openApi);
  });
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApi, { customSiteTitle: 'Hajira API', swaggerOptions: { persistAuthorization: true } }));

  app.use('/api/v1', apiLimiter, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
