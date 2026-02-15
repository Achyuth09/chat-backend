import { Router } from 'express';
import * as notificationController from '../controllers/notificationController.js';

const router = Router();

router.get('/', notificationController.listNotifications);
router.post('/read-all', notificationController.markAllNotificationsRead);

export default router;
