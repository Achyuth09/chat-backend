import { Router } from 'express';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ ok: true, message: 'Chat API is running' });
});

export default router;
