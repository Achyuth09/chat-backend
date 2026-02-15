import User from '../models/User.js';
import FriendRequest from '../models/FriendRequest.js';
import { logger } from '../utils/logger.js';
import { uploadMedia } from '../services/uploadService.js';

/**
 * GET /api/users – list all users (id, username) for DM. Excludes current user.
 */
export async function listUsers(req, res) {
  try {
    const accepted = await FriendRequest.find({
      status: 'accepted',
      $or: [{ from: req.user.id }, { to: req.user.id }],
    })
      .select('from to')
      .lean();

    const friendIds = accepted
      .map((fr) => {
        const from = fr.from?.toString?.() || '';
        const to = fr.to?.toString?.() || '';
        return from === req.user.id ? to : from;
      })
      .filter(Boolean);

    if (friendIds.length === 0) {
      logger.info('users listed', { requester: req.user?.username, count: 0 });
      return res.json([]);
    }

    const users = await User.find({ _id: { $in: friendIds } })
      .select('_id username avatarUrl')
      .sort({ username: 1 })
      .lean();

    const result = users.map((u) => ({
      id: u._id.toString(),
      username: u.username,
      avatarUrl: u.avatarUrl || '',
    }));
    logger.info('users listed', { requester: req.user?.username, count: result.length });
    res.json(result);
  } catch (err) {
    logger.error('list users failed', { requester: req.user?.username, error: err.message });
    res.status(500).json({ error: 'Failed to fetch users' });
  }
}

export async function getUserByUsername(req, res) {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username }).select('_id username avatarUrl');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({
      id: user._id.toString(),
      username: user.username,
      avatarUrl: user.avatarUrl || '',
    });
  } catch (err) {
    logger.error('get user by username failed', { by: req.user?.username, error: err.message });
    res.status(500).json({ error: 'Failed to get user by username' });
  }
}

/**
 * GET /api/users/search?q=abc – find users by username.
 */
export async function searchUsers(req, res) {
  try {
    const query = String(req.query?.q || '').trim().toLowerCase();
    if (!query) return res.json([]);

    const users = await User.find({
      _id: { $ne: req.user.id },
      username: { $regex: query, $options: 'i' },
    })
      .select('_id username avatarUrl')
      .sort({ username: 1 })
      .limit(20)
      .lean();

    res.json(
      users.map((u) => ({
        id: u._id.toString(),
        username: u.username,
        avatarUrl: u.avatarUrl || '',
      }))
    );
  } catch (err) {
    logger.error('search users failed', { by: req.user?.username, error: err.message });
    res.status(500).json({ error: 'Failed to search users' });
  }
}

/**
 * POST /api/users/me/avatar – upload and update current user avatar.
 */
export async function updateMyAvatar(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'file is required' });
    const media = await uploadMedia(req.file, 'chat-app/avatars');
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { avatarUrl: media.url } },
      { new: true }
    )
      .select('_id username avatarUrl')
      .lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
      id: user._id.toString(),
      username: user.username,
      avatarUrl: user.avatarUrl || '',
    });
  } catch (err) {
    logger.error('update avatar failed', { by: req.user?.username, error: err.message });
    res.status(500).json({ error: 'Failed to update avatar' });
  }
}
