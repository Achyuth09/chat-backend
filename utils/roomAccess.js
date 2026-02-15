import Group from '../models/Group.js';
import FriendRequest from '../models/FriendRequest.js';

function parseDmRoom(roomId) {
  const parts = roomId.split(':');
  if (parts.length !== 3 || parts[0] !== 'dm') return null;
  return [parts[1], parts[2]];
}

function parseGroupRoom(roomId) {
  if (!roomId?.startsWith('group:')) return null;
  const groupId = roomId.slice('group:'.length);
  return groupId || null;
}

export async function canAccessRoom(roomId, userId) {
  if (!roomId || !userId) {
    return { ok: false, reason: 'missing room or user' };
  }

  const dmUsers = parseDmRoom(roomId);
  if (dmUsers) {
    if (!dmUsers.includes(userId)) {
      return { ok: false, reason: 'dm member mismatch' };
    }
    const [userA, userB] = dmUsers;
    const accepted = await FriendRequest.findOne({
      status: 'accepted',
      $or: [
        { from: userA, to: userB },
        { from: userB, to: userA },
      ],
    })
      .select('_id')
      .lean();
    return { ok: Boolean(accepted), reason: 'friend request not accepted' };
  }

  const groupId = parseGroupRoom(roomId);
  if (groupId) {
    const group = await Group.findById(groupId).select('_id members').lean();
    if (!group) return { ok: false, reason: 'group not found' };
    const isMember = group.members.some((id) => id.toString() === userId);
    return { ok: isMember, reason: 'not a group member' };
  }

  // Public room (legacy room names) remains open to authenticated users.
  return { ok: true };
}
