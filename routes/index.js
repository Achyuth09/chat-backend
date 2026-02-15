import { Router } from 'express';
import messageRoutes from './messages.js';
import authRoutes from './auth.js';
import userRoutes from './users.js';
import groupRoutes from './groups.js';
import postRoutes from './posts.js';
import uploadRoutes from './upload.js';
import friendRequestRoutes from './friendRequests.js';
import notificationRoutes from './notifications.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ ok: true, message: 'Chat API is running' });
});

router.use('/auth', authRoutes);
router.use('/users', requireAuth, userRoutes);
router.use('/groups', requireAuth, groupRoutes);
router.use('/messages', requireAuth, messageRoutes);
router.use('/posts', requireAuth, postRoutes);
router.use('/upload', requireAuth, uploadRoutes);
router.use('/friend-requests', requireAuth, friendRequestRoutes);
router.use('/notifications', requireAuth, notificationRoutes);

export default router;
