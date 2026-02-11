import 'dotenv/config';
import http from 'http';
import express from 'express';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { connectDB } from './db.js';
import routes from './routes/index.js';
import * as messageService from './services/messageService.js';
import User from './models/User.js';
import { canAccessRoom } from './utils/roomAccess.js';
import { createRequestLogger, logger } from './utils/logger.js';

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
    const { roomId, text } = payload || {};
    const sender = socket.user?.username;
    if (!roomId || !sender || !text) {
      logger.warn('socket send_message rejected', {
        socketId: socket.id,
        roomId,
        hasSender: Boolean(sender),
        hasText: Boolean(text),
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
      const message = await messageService.create({ roomId, sender, text });
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

  socket.on('disconnect', (reason) => {
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
