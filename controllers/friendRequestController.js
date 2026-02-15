import { logger } from '../utils/logger.js';
import User from '../models/User.js';
import FriendRequest from '../models/FriendRequest.js';
import { createNotification } from '../services/notificationService.js';

export async function getFriendRequests(req, res) {
  try {
    const friendRequests = await FriendRequest.find({ to: req.user.id, status: 'pending' })
      .populate('from', '_id username avatarUrl')
      .lean();
    res.json(
      friendRequests.map((fr) => ({
        id: fr._id.toString(),
        from: {
          id: fr.from?._id?.toString?.() || '',
          username: fr.from?.username || '',
          avatarUrl: fr.from?.avatarUrl || '',
        },
        status: fr.status,
        createdAt: fr.createdAt,
      }))
    );
  } catch (err) {
    logger.error('get friend requests failed', { by: req.user?.username, error: err.message });
    res.status(500).json({ error: 'Failed to get friend requests' });
  }
}

export async function getSentFriendRequests(req, res) {
  try {
    const friendRequests = await FriendRequest.find({ from: req.user.id, status: 'pending' })
      .populate('to', '_id username avatarUrl')
      .lean();
    res.json(
      friendRequests.map((fr) => ({
        id: fr._id.toString(),
        to: {
          id: fr.to?._id?.toString?.() || '',
          username: fr.to?.username || '',
          avatarUrl: fr.to?.avatarUrl || '',
        },
        status: fr.status,
        createdAt: fr.createdAt,
      }))
    );
  } catch (err) {
    logger.error('get sent friend requests failed', { by: req.user?.username, error: err.message });
    res.status(500).json({ error: 'Failed to get sent friend requests' });
  }
}

export async function createFriendRequest(req, res) {
  try {
    const { to } = req.body;
    if (!to) return res.status(400).json({ error: 'Recipient is required' });
    if (to === req.user.id) return res.status(400).json({ error: 'Cannot request yourself' });

    const target = await User.findById(to).select('_id').lean();
    if (!target) return res.status(404).json({ error: 'User not found' });

    const existing = await FriendRequest.findOne({ from: req.user.id, to }).lean();
    if (existing?.status === 'pending') {
      return res.status(409).json({ error: 'Request already sent' });
    }

    const reversePending = await FriendRequest.findOne({
      from: to,
      to: req.user.id,
      status: 'pending',
    }).lean();
    if (reversePending) {
      return res.status(409).json({ error: 'This user already sent you a request' });
    }

    const friendRequest = existing
      ? await FriendRequest.findByIdAndUpdate(
          existing._id,
          { $set: { status: 'pending' } },
          { new: true }
        ).lean()
      : await FriendRequest.create({ from: req.user.id, to });

    const result = friendRequest.toObject ? friendRequest.toObject() : friendRequest;
    await createNotification({
      recipient: to,
      actor: req.user.id,
      type: 'friend_request_received',
      friendRequest: result._id,
    });
    res.status(201).json({
      id: result._id.toString(),
      from: req.user.id,
      to,
      status: result.status,
    });
  } catch (err) {
    logger.error('create friend request failed', { by: req.user?.username, error: err.message });
    res.status(500).json({ error: 'Failed to create friend request' });
  }
}

export async function deleteFriendRequest(req, res) {
  try {
    const { id } = req.params;
    const request = await FriendRequest.findById(id);
    if (!request) return res.status(404).json({ error: 'Request not found' });
    const canModify =
      request.from.toString() === req.user.id || request.to.toString() === req.user.id;
    if (!canModify) return res.status(403).json({ error: 'Not allowed' });
    await FriendRequest.findByIdAndDelete(id);
    res.status(204).send();
  } catch (err) {
    logger.error('delete friend request failed', { by: req.user?.username, error: err.message });
    res.status(500).json({ error: 'Failed to delete friend request' });
  }
}

export async function acceptFriendRequest(req, res) {
  try {
    const { id } = req.params;
    const request = await FriendRequest.findById(id);
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.to.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Only receiver can accept' });
    }
    request.status = 'accepted';
    await request.save();
    await createNotification({
      recipient: request.from.toString(),
      actor: req.user.id,
      type: 'friend_request_accepted',
      friendRequest: request._id.toString(),
    });
    res.json({ ok: true, status: 'accepted' });
  } catch (err) {
    logger.error('accept friend request failed', { by: req.user?.username, error: err.message });
    res.status(500).json({ error: 'Failed to accept friend request' });
  }
}
