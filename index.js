import dotenv from 'dotenv';
import http from 'http';
import express from 'express';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import path from 'path';
import { connectDB } from './db.js';
import routes from './routes/index.js';
import * as messageService from './services/messageService.js';
import User from './models/User.js';
import Group from './models/Group.js';
import { canAccessRoom } from './utils/roomAccess.js';
import { createRequestLogger, logger } from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env'), override: true });

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost')
  .split(',')
  .map((x) => x.trim())
  .filter(Boolean);

const io = new Server(server, {
  cors: { origin: allowedOrigins, credentials: true },
});
const activeCallParticipants = new Map();

function parseDmRoom(roomId) {
  const parts = String(roomId || '').split(':');
  if (parts.length !== 3 || parts[0] !== 'dm') return null;
  return [parts[1], parts[2]];
}

function parseGroupRoom(roomId) {
  if (!String(roomId || '').startsWith('group:')) return null;
  const groupId = roomId.slice('group:'.length);
  return groupId || null;
}

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use(createRequestLogger());
app.use('/api', routes);

io.on('connection', (socket) => {
  logger.info('socket connected', { socketId: socket.id });

  const token = socket.handshake.auth?.token;
  const authPromise = (async () => {
    if (!token) {
      logger.warn('socket connected without token', { socketId: socket.id });
      return;
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.id).select('_id username');
      if (user) {
        socket.user = { id: user._id.toString(), username: user.username };
        socket.join(`user:${socket.user.id}`);
        logger.info('socket authenticated', {
          socketId: socket.id,
          userId: socket.user.id,
          username: socket.user.username,
        });
      } else {
        logger.warn('socket auth user missing', { socketId: socket.id, userId: decoded.id });
      }
    } catch (err) {
      logger.warn('socket auth failed', { socketId: socket.id, error: err.message });
    }
  })();

  socket.on('join_room', async (roomId) => {
    const nextRoomId = typeof roomId === 'string' ? roomId : roomId?.roomId;
    if (!nextRoomId) return;
    await authPromise;
    if (!socket.user) return;

    const access = await canAccessRoom(nextRoomId, socket.user.id);
    if (!access.ok) {
      logger.warn('socket join rejected', {
        socketId: socket.id,
        roomId: nextRoomId,
        username: socket.user.username,
      });
      return;
    }

    socket.join(nextRoomId);
    logger.info('socket joined room', {
      socketId: socket.id,
      roomId: nextRoomId,
      username: socket.user.username,
    });
  });

  socket.on('send_message', async (payload) => {
    await authPromise;
    const { roomId } = payload || {};
    const text = String(payload?.text || '').trim();
    const attachments = Array.isArray(payload?.attachments) ? payload.attachments : [];
    const sender = socket.user?.username;
    if (!roomId || !sender || (!text && attachments.length === 0)) {
      logger.warn('socket send_message rejected', {
        socketId: socket.id,
        roomId,
        hasSender: Boolean(sender),
        hasText: Boolean(text),
        hasAttachments: attachments.length > 0,
      });
      return;
    }
    const access = await canAccessRoom(roomId, socket.user.id);
    if (!access.ok) {
      logger.warn('socket send_message rejected by access', {
        socketId: socket.id,
        roomId,
        sender,
      });
      return;
    }

    try {
      const message = await messageService.create({ roomId, sender, text, attachments });
      const plain = message.toObject ? message.toObject() : message;
      io.to(roomId).emit('new_message', plain);
      logger.info('socket message broadcast', {
        socketId: socket.id,
        roomId,
        sender,
        messageId: plain._id?.toString?.() || plain._id,
      });
    } catch (err) {
      logger.error('socket send_message error', {
        socketId: socket.id,
        roomId,
        sender,
        error: err.message,
      });
    }
  });

  socket.on('call_join', async (payload) => {
    await authPromise;
    const roomId = typeof payload === 'string' ? payload : payload?.roomId;
    if (!roomId || !socket.user) return;

    const access = await canAccessRoom(roomId, socket.user.id);
    if (!access.ok) return;

    socket.join(roomId);
    const nextSet = activeCallParticipants.get(roomId) || new Set();
    nextSet.add(socket.user.id);
    activeCallParticipants.set(roomId, nextSet);

    const participants = Array.from(nextSet);
    socket.emit('call_participants', { roomId, participants });
    socket.to(roomId).emit('call_joined', {
      roomId,
      userId: socket.user.id,
      username: socket.user.username,
    });
  });

  socket.on('call_leave', (payload) => {
    const roomId = typeof payload === 'string' ? payload : payload?.roomId;
    if (!roomId || !socket.user) return;
    const set = activeCallParticipants.get(roomId);
    if (set) {
      set.delete(socket.user.id);
      if (set.size === 0) activeCallParticipants.delete(roomId);
      else activeCallParticipants.set(roomId, set);
    }
    socket.to(roomId).emit('call_left', { roomId, userId: socket.user.id });
  });

  socket.on('call_invite', async (payload) => {
    await authPromise;
    if (!socket.user) return;
    const roomId = payload?.roomId;
    if (!roomId) return;
    const access = await canAccessRoom(roomId, socket.user.id);
    if (!access.ok) return;
    const body = {
      roomId,
      from: { id: socket.user.id, username: socket.user.username },
      at: Date.now(),
    };

    const dmUsers = parseDmRoom(roomId);
    if (dmUsers) {
      for (const userId of dmUsers) {
        if (userId === socket.user.id) continue;
        io.to(`user:${userId}`).emit('incoming_call', body);
      }
      // Also notify sockets already joined to this DM room.
      socket.to(roomId).emit('incoming_call', body);
      return;
    }

    const groupId = parseGroupRoom(roomId);
    if (groupId) {
      const group = await Group.findById(groupId).select('members').lean();
      if (group?.members?.length) {
        for (const memberId of group.members.map((id) => id.toString())) {
          if (memberId === socket.user.id) continue;
          io.to(`user:${memberId}`).emit('incoming_call', body);
        }
        socket.to(roomId).emit('incoming_call', body);
        return;
      }
    }

    io.to(roomId).emit('incoming_call', {
      ...body,
      // fallback for legacy/public rooms
    });
  });

  socket.on('call_accept', async (payload) => {
    await authPromise;
    if (!socket.user) return;
    const roomId = payload?.roomId;
    if (!roomId) return;
    const access = await canAccessRoom(roomId, socket.user.id);
    if (!access.ok) return;
    io.to(roomId).emit('call_accept', {
      roomId,
      userId: socket.user.id,
      username: socket.user.username,
    });
  });

  socket.on('call_reject', async (payload) => {
    await authPromise;
    if (!socket.user) return;
    const roomId = payload?.roomId;
    if (!roomId) return;
    const access = await canAccessRoom(roomId, socket.user.id);
    if (!access.ok) return;
    io.to(roomId).emit('call_reject', {
      roomId,
      userId: socket.user.id,
      username: socket.user.username,
    });
  });

  socket.on('call_end', async (payload) => {
    await authPromise;
    if (!socket.user) return;
    const roomId = payload?.roomId;
    if (!roomId) return;
    const access = await canAccessRoom(roomId, socket.user.id);
    if (!access.ok) return;
    activeCallParticipants.delete(roomId);
    io.to(roomId).emit('call_ended', { roomId, endedBy: socket.user.id });
  });

  socket.on('webrtc_offer', async (payload) => {
    await authPromise;
    if (!socket.user) return;
    const { roomId, targetUserId, sdp } = payload || {};
    if (!roomId || !targetUserId || !sdp) return;
    const access = await canAccessRoom(roomId, socket.user.id);
    if (!access.ok) return;
    socket.to(roomId).emit('webrtc_offer', {
      roomId,
      fromUserId: socket.user.id,
      targetUserId,
      sdp,
    });
  });

  socket.on('webrtc_answer', async (payload) => {
    await authPromise;
    if (!socket.user) return;
    const { roomId, targetUserId, sdp } = payload || {};
    if (!roomId || !targetUserId || !sdp) return;
    const access = await canAccessRoom(roomId, socket.user.id);
    if (!access.ok) return;
    socket.to(roomId).emit('webrtc_answer', {
      roomId,
      fromUserId: socket.user.id,
      targetUserId,
      sdp,
    });
  });

  socket.on('webrtc_ice_candidate', async (payload) => {
    await authPromise;
    if (!socket.user) return;
    const { roomId, targetUserId, candidate } = payload || {};
    if (!roomId || !targetUserId || !candidate) return;
    const access = await canAccessRoom(roomId, socket.user.id);
    if (!access.ok) return;
    socket.to(roomId).emit('webrtc_ice_candidate', {
      roomId,
      fromUserId: socket.user.id,
      targetUserId,
      candidate,
    });
  });

  socket.on('disconnect', (reason) => {
    if (socket.user?.id) {
      for (const [roomId, participants] of activeCallParticipants.entries()) {
        if (participants.has(socket.user.id)) {
          participants.delete(socket.user.id);
          if (participants.size === 0) activeCallParticipants.delete(roomId);
          else activeCallParticipants.set(roomId, participants);
          socket.to(roomId).emit('call_left', { roomId, userId: socket.user.id });
        }
      }
    }
    logger.info('socket disconnected', {
      socketId: socket.id,
      username: socket.user?.username,
      reason,
    });
  });
});

connectDB()
  .then(() => {
    server.listen(PORT, () => {
      logger.info('server started', { port: PORT });
    });
  })
  .catch((err) => {
    logger.error('failed to start server', { error: err.message });
    process.exit(1);
  });
