import { Router } from 'express';
import * as groupController from '../controllers/groupController.js';

const router = Router();

router.get('/', groupController.listGroups);
router.post('/', groupController.createGroup);
router.post('/:groupId/members', groupController.addMember);
router.delete('/:groupId/members/:userId', groupController.removeMember);

export default router;
