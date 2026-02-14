import Message from '../models/Message.js';

/**
 * Get all messages in a room, oldest first.
 */
export async function getByRoom(roomId) {
  return Message.find({ roomId }).sort({ createdAt: 1 }).lean();
}

/**
 * Create a new message. Returns the saved document.
 */
export async function create({ roomId, sender, text = '', attachments = [] }) {
  return Message.create({ roomId, sender, text, attachments });
}
