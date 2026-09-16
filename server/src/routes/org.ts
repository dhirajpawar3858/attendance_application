import { Router } from 'express';
import { wrap } from '../middleware/error.ts';
import { requireAuth } from '../middleware/auth.ts';
import * as org from '../services/org.ts';

const router = Router();
router.use(requireAuth);

router.get('/', wrap((req, res) => res.json(org.listOrgs(req.user!.id))));

router.get('/:id', wrap((req, res) =>
  res.json(org.getOrg(req.user!.id, Number(req.params.id))),
));

router.post('/', wrap((req, res) => res.json(org.createOrg(req.user!.id, req.body))));

router.put('/:id', wrap((req, res) =>
  res.json(org.updateOrg(req.user!.id, Number(req.params.id), req.body)),
));

router.delete('/:id', wrap((req, res) => {
  org.archiveOrg(req.user!.id, Number(req.params.id));
  res.json({ ok: true });
}));

export default router;
