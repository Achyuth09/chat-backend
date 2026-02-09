import User from '../models/User.js';

/**
 * GET /api/users – list all users (id, username) for DM. Excludes current user.
 */
export async function listUsers(req, res) {
  try {
    const users = await User.find({ _id: { $ne: req.user.id } })
      .select('_id username')
      .sort({ username: 1 })
      .lean();
    res.json(users.map((u) => ({ id: u._id.toString(), username: u.username })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
}
