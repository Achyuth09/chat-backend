import { Router } from 'express';
import * as friendRequestController from '../controllers/friendRequestController.js';

const router = Router();

router.get('/', friendRequestController.getFriendRequests);
router.post('/', friendRequestController.createFriendRequest);
router.post('/:id/accept', friendRequestController.acceptFriendRequest);
router.delete('/:id', friendRequestController.deleteFriendRequest);

export default router;
