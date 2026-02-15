import Notification from '../models/Notification.js';
import { logger } from '../utils/logger.js';

function toDto(item) {
  return {
    id: item._id.toString(),
    type: item.type,
    read: Boolean(item.readAt),
    createdAt: item.createdAt,
    actor: {
      id: item.actor?._id?.toString?.() || '',
      username: item.actor?.username || '',
      avatarUrl: item.actor?.avatarUrl || '',
    },
    postId: item.post?._id?.toString?.() || item.post?.toString?.() || '',
    friendRequestId: item.friendRequest?._id?.toString?.() || item.friendRequest?.toString?.() || '',
    commentText: item.commentText || '',
  };
}

export async function listNotifications(req, res) {
  try {
    const limit = Math.min(Number(req.query.limit || 50), 100);
    const notifications = await Notification.find({ recipient: req.user.id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('actor', '_id username avatarUrl')
      .lean();

    const unreadCount = notifications.reduce((count, item) => count + (item.readAt ? 0 : 1), 0);
    res.json({
      items: notifications.map(toDto),
      unreadCount,
    });
  } catch (err) {
    logger.error('list notifications failed', { by: req.user?.username, error: err.message });
    res.status(500).json({ error: 'Failed to load notifications' });
  }
}

export async function markAllNotificationsRead(req, res) {
  try {
    await Notification.updateMany(
      { recipient: req.user.id, readAt: null },
      { $set: { readAt: new Date() } }
    );
    res.json({ ok: true });
  } catch (err) {
    logger.error('mark notifications read failed', { by: req.user?.username, error: err.message });
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
}
