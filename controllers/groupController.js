import Group from '../models/Group.js';
import User from '../models/User.js';
import { logger } from '../utils/logger.js';

function toGroupDto(group) {
  return {
    id: group._id.toString(),
    name: group.name,
    roomId: `group:${group._id.toString()}`,
    createdBy: group.createdBy
      ? {
          id: group.createdBy._id?.toString?.() || group.createdBy.toString(),
          username: group.createdBy.username,
        }
      : null,
    admins: (group.admins || []).map((id) => id.toString()),
    members: (group.members || []).map((m) => ({
      id: m._id?.toString?.() || m.toString(),
      username: m.username || '',
    })),
  };
}

export async function listGroups(req, res) {
  try {
    const groups = await Group.find({ members: req.user.id })
      .sort({ updatedAt: -1 })
      .populate('createdBy', '_id username')
      .populate('members', '_id username')
      .lean();

    const result = groups.map(toGroupDto);
    logger.info('groups listed', { requester: req.user.username, count: result.length });
    res.json(result);
  } catch (err) {
    logger.error('list groups failed', { requester: req.user.username, error: err.message });
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
}

export async function createGroup(req, res) {
  try {
    const name = req.body?.name?.trim();
    const seedUsernames = Array.isArray(req.body?.members) ? req.body.members : [];

    if (!name) return res.status(400).json({ error: 'Group name is required' });

    const users = await User.find({
      username: { $in: seedUsernames.map((u) => String(u).trim().toLowerCase()) },
    })
      .select('_id username')
      .lean();

    const memberIds = new Set([req.user.id, ...users.map((u) => u._id.toString())]);
    const group = await Group.create({
      name,
      createdBy: req.user.id,
      admins: [req.user.id],
      members: Array.from(memberIds),
    });

    const hydrated = await Group.findById(group._id)
      .populate('createdBy', '_id username')
      .populate('members', '_id username')
      .lean();

    logger.info('group created', { groupId: group._id.toString(), by: req.user.username });
    res.status(201).json(toGroupDto(hydrated));
  } catch (err) {
    logger.error('create group failed', { by: req.user.username, error: err.message });
    res.status(500).json({ error: 'Failed to create group' });
  }
}

export async function addMember(req, res) {
  try {
    const { groupId } = req.params;
    const username = req.body?.username?.trim()?.toLowerCase();
    if (!username) return res.status(400).json({ error: 'username is required' });

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const isAdmin = group.admins.some((id) => id.toString() === req.user.id);
    if (!isAdmin) return res.status(403).json({ error: 'Only group admin can add members' });

    const user = await User.findOne({ username }).select('_id username').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const alreadyMember = group.members.some((id) => id.toString() === user._id.toString());
    if (!alreadyMember) {
      group.members.push(user._id);
      await group.save();
    }

    const hydrated = await Group.findById(group._id)
      .populate('createdBy', '_id username')
      .populate('members', '_id username')
      .lean();

    logger.info('group member added', {
      groupId: group._id.toString(),
      by: req.user.username,
      added: username,
    });
    res.json(toGroupDto(hydrated));
  } catch (err) {
    logger.error('add group member failed', { by: req.user.username, error: err.message });
    res.status(500).json({ error: 'Failed to add member' });
  }
}

export async function removeMember(req, res) {
  try {
    const { groupId, userId } = req.params;
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const isAdmin = group.admins.some((id) => id.toString() === req.user.id);
    if (!isAdmin) return res.status(403).json({ error: 'Only group admin can remove members' });
    if (group.createdBy.toString() === userId) {
      return res.status(400).json({ error: 'Group creator cannot be removed' });
    }

    group.members = group.members.filter((id) => id.toString() !== userId);
    group.admins = group.admins.filter((id) => id.toString() !== userId);
    await group.save();

    const hydrated = await Group.findById(group._id)
      .populate('createdBy', '_id username')
      .populate('members', '_id username')
      .lean();

    logger.info('group member removed', {
      groupId: group._id.toString(),
      by: req.user.username,
      removedUserId: userId,
    });
    res.json(toGroupDto(hydrated));
  } catch (err) {
    logger.error('remove group member failed', { by: req.user.username, error: err.message });
    res.status(500).json({ error: 'Failed to remove member' });
  }
}
