import * as messageService from '../services/messageService.js';

/**
 * GET /api/messages?roomId=xxx
 */
export async function getMessages(req, res) {
  try {
    const { roomId } = req.query;
    if (!roomId) {
      return res.status(400).json({ error: 'roomId is required' });
    }
    const messages = await messageService.getByRoom(roomId);
    res.json(messages);
  } catch (err) {
    console.error(err);
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
    const message = await messageService.create({ roomId, sender, text });
    res.status(201).json(message);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save message' });
  }
}
