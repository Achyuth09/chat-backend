import * as messageService from '../services/messageService.js';
import { logger } from '../utils/logger.js';
import { canAccessRoom } from '../utils/roomAccess.js';

/**
 * GET /api/messages?roomId=xxx
 */
export async function getMessages(req, res) {
  try {
    const { roomId } = req.query;
    if (!roomId) {
      return res.status(400).json({ error: 'roomId is required' });
    }
    const access = await canAccessRoom(roomId, req.user.id);
    if (!access.ok) {
      return res.status(403).json({ error: 'You do not have access to this room' });
    }

    const messages = await messageService.getByRoom(roomId);
    logger.info('messages fetched', {
      roomId,
      count: messages.length,
      username: req.user?.username,
    });
    res.json(messages);
  } catch (err) {
    logger.error('fetch messages failed', {
      roomId: req.query?.roomId,
      username: req.user?.username,
      error: err.message,
    });
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
}

/**
 * POST /api/messages – body: { roomId, text }. Sender from req.user (auth).
 */
export async function createMessage(req, res) {
  try {
    const { roomId, text } = req.body;
    const sender = req.user?.username;
    if (!roomId || !sender || !text) {
      return res.status(400).json({
        error: 'roomId and text are required',
      });
    }
    const access = await canAccessRoom(roomId, req.user.id);
    if (!access.ok) {
      return res.status(403).json({ error: 'You do not have access to this room' });
    }

    const message = await messageService.create({ roomId, sender, text });
    logger.info('message created via REST', {
      roomId,
      sender,
      messageId: message._id?.toString(),
    });
    res.status(201).json(message);
  } catch (err) {
    logger.error('save message failed', {
      roomId: req.body?.roomId,
      sender: req.user?.username,
      error: err.message,
    });
    res.status(500).json({ error: 'Failed to save message' });
  }
}
