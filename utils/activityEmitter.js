let _io = null;

export function init(io) {
  _io = io;
}

export function emitActivity(userId) {
  if (!_io || !userId) return;
  _io.to(`user:${userId}`).emit('activity_update');
}
