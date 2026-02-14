import User from '../models/User.js';
import { logger } from '../utils/logger.js';

/**
 * GET /api/users – list all users (id, username) for DM. Excludes current user.
 */
export async function listUsers(req, res) {
  try {
    const users = await User.find({ _id: { $ne: req.user.id } })
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
