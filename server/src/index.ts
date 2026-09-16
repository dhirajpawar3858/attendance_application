// Express bootstrap. Serves the JSON API and, in --prod, the built client bundle.
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { migrate } from './db/migrate.ts';
import { errorHandler } from './middleware/error.ts';
import authRoutes from './routes/auth.ts';
import orgRoutes from './routes/org.ts';
import orgDataRoutes from './routes/orgData.ts';
import backupRoutes from './routes/backup.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROD = process.argv.includes('--prod') || process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT || (PROD ? 3000 : 3001));

// ensure schema exists before serving
migrate();

const app = express();
app.use(express.json({ limit: '25mb' })); // large limit for base64 logos/backups
app.use(cookieParser());

// In dev the client runs on :5173 with a proxy, but allow credentials CORS anyway.
if (!PROD) {
  app.use(
    cors({
      origin: (origin, cb) => cb(null, true),
      credentials: true,
    }),
  );
}

// API
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/orgs', orgRoutes);
app.use('/api/orgs/:orgId', orgDataRoutes);
app.use('/api/backup', backupRoutes);

// error handler after routes
app.use('/api', errorHandler);

// In production, serve the built client and SPA-fallback to index.html
if (PROD) {
  const clientDist = join(__dirname, '..', '..', 'client', 'dist');
  if (existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (_req, res) => res.sendFile(join(clientDist, 'index.html')));
  } else {
    console.warn('[server] client/dist not found — run `npm run build` first.');
  }
}

app.listen(PORT, () => {
  console.log(`\n  Attendance server running: http://localhost:${PORT}`);
  if (!PROD) console.log('  (dev) client: http://localhost:5173\n');
});
