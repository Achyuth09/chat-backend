import { Router } from 'express';
import * as postController from '../controllers/postController.js';

const router = Router();

router.get('/', postController.listPosts);
router.post('/', postController.createPost);
router.get('/:postId', postController.getPostById);
router.delete('/:postId', postController.deletePost);
router.post('/:postId/like', postController.toggleLike);
router.post('/:postId/comments', postController.addComment);

export default router;
