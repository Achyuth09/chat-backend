import { Router } from 'express';
import * as messageController from '../controllers/messageController.js';

const router = Router();

router.get('/', messageController.getMessages);
router.post('/', messageController.createMessage);

export default router;
