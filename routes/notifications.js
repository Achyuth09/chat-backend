import { Router } from 'express';
import * as notificationController from '../controllers/notificationController.js';

const router = Router();

router.get('/', notificationController.listNotifications);
router.post('/read-all', notificationController.markAllNotificationsRead);
router.post('/:id/read', notificationController.markNotificationRead);

export default router;
