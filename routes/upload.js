import { Router } from 'express';
import multer from 'multer';
import { uploadMedia } from '../services/uploadService.js';
import { logger } from '../utils/logger.js';

const router = Router();
const maxUploadMb = Number(process.env.MAX_UPLOAD_MB || 20);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxUploadMb * 1024 * 1024 },
});

router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'file is required' });
    const media = await uploadMedia(req.file, 'chat-app/media');
    logger.info('media uploaded', {
      by: req.user?.username,
      type: media.type,
      bytes: media.bytes,
      publicId: media.publicId,
    });
    res.status(201).json(media);
  } catch (err) {
    logger.error('media upload failed', {
      by: req.user?.username,
      error: err.message,
    });
    res.status(500).json({ error: 'Failed to upload media' });
  }
});

export default router;
