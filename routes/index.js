import { Router } from 'express';
import messageRoutes from './messages.js';
import authRoutes from './auth.js';
import userRoutes from './users.js';
import groupRoutes from './groups.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ ok: true, message: 'Chat API is running' });
});

router.use('/auth', authRoutes);
router.use('/users', requireAuth, userRoutes);
router.use('/groups', requireAuth, groupRoutes);
router.use('/messages', requireAuth, messageRoutes);

export default router;
