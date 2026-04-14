import authRoutes from './routes/auth.routes.js';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { isMongoConnected } from './config/db.js';
import { env, isProduction } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFound } from './middleware/not-found.js';
import { analyzeRateLimiter } from './middleware/rate-limit.js';
import analyzeRoutes from './routes/analyze.routes.js';
import analysisRoutes from './routes/analysis.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDirectory = path.join(__dirname, '..', 'public');
const require = createRequire(import.meta.url);
const chartBundlePath = path.join(path.dirname(require.resolve('chart.js')), 'chart.umd.js');

const app = express();

app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"]
    }
  }
}));
app.use(cors({
  origin: env.corsOrigin === '*' ? true : env.corsOrigin.split(',').map((origin) => origin.trim()),
  credentials: false
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(morgan(isProduction ? 'combined' : 'dev'));

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    environment: env.nodeEnv,
    mongoConnected: isMongoConnected()
  });
});

app.get('/vendor/chart.js', (_req, res) => {
  res.sendFile(chartBundlePath);
});

app.use('/analyze', analyzeRateLimiter, analyzeRoutes);
app.use('/analysis', analysisRoutes);
app.use('/auth', authRoutes);
app.use(express.static(publicDirectory));

app.get('*', (req, res, next) => {
  const isApiRequest = ['/health', '/analyze', '/analysis', '/vendor/chart.js'].some((prefix) => req.path.startsWith(prefix));
  const wantsHtml = req.headers.accept?.includes('text/html');

  if (isApiRequest || !wantsHtml) {
    return next();
  }

  return res.sendFile(path.join(publicDirectory, 'index.html'));
});

app.use(notFound);
app.use(errorHandler);

export default app;
