import 'dotenv/config';
import http from 'http';
import express from 'express';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import cors from 'cors';
import { connectDB } from './db.js';
import routes from './routes/index.js';
import * as messageService from './services/messageService.js';
import User from './models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

const io = new Server(server, {
  cors: { origin: '*' },
});

app.use(cors());
app.use(express.json());
app.use('/api', routes);

io.on('connection', (socket) => {
  // Auth in background so join_room handler is registered immediately
  const token = socket.handshake.auth?.token;
  if (token) {
    (async () => {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.id).select('_id username');
        if (user) socket.user = { id: user._id.toString(), username: user.username };
      } catch (_) {}
    })();
  }

  socket.on('join_room', (roomId) => {
    if (roomId) socket.join(roomId);
  });

  socket.on('send_message', async (payload) => {
    const { roomId, text } = payload || {};
    const sender = socket.user?.username;
    if (!roomId || !sender || !text) return;
    try {
      const message = await messageService.create({ roomId, sender, text });
      const plain = message.toObject ? message.toObject() : message;
      io.to(roomId).emit('new_message', plain);
    } catch (err) {
      console.error('Socket send_message error:', err);
    }
  });
});

connectDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
