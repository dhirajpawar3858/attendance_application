import { Router } from 'express';
import { wrap } from '../middleware/error.ts';
import { requireAuth } from '../middleware/auth.ts';
import * as backup from '../services/backup.ts';

const router = Router();
router.use(requireAuth);

// download raw .db file
router.get('/download', wrap((_req, res) => {
  const bytes = backup.backupBytes();
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', 'attachment; filename="attendance-backup.db"');
  res.send(bytes);
}));

// restore from uploaded base64 .db
router.post('/restore', wrap((req, res) => {
  const b64 = req.body.data as string;
  if (!b64) return res.status(400).json({ error: 'No file data provided' });
  const raw = b64.includes(',') ? b64.split(',')[1] : b64;
  backup.restoreFromBytes(Buffer.from(raw, 'base64'));
  res.json({ ok: true });
}));

// export all data as JSON
router.get('/export-all', wrap((_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="attendance-export.json"');
  res.send(JSON.stringify(backup.exportAllJSON(), null, 2));
}));

// danger: reset all data
router.post('/reset', wrap((req, res) => {
  if (req.body.confirm !== 'RESET') return res.status(400).json({ error: 'Confirmation required' });
  backup.resetAll();
  res.json({ ok: true });
}));

export default router;
