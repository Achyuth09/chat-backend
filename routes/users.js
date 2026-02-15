import { Router } from 'express';
import * as userController from '../controllers/userController.js';
import { requireAuth } from '../middleware/auth.js';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/', requireAuth, userController.listUsers);
router.get('/search', requireAuth, userController.searchUsers);
router.get('/username/:username', requireAuth, userController.getUserByUsername);
router.post('/me/avatar', requireAuth, upload.single('file'), userController.updateMyAvatar);

export default router;
