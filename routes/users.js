import { Router } from 'express';
import * as userController from '../controllers/userController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, userController.listUsers);

export default router;
