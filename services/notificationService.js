import Notification from '../models/Notification.js';
import { logger } from '../utils/logger.js';

export async function createNotification(payload) {
  try {
    const { recipient, actor, type, post, friendRequest, commentText } = payload || {};
    if (!recipient || !actor || !type) return null;
    if (String(recipient) === String(actor)) return null;
    return await Notification.create({
      recipient,
      actor,
      type,
      post,
      friendRequest,
      commentText: commentText || '',
    });
  } catch (err) {
    logger.error('create notification failed', { error: err.message, type: payload?.type });
    return null;
  }
}
