import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { logger } from '../utils/logger.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

/**
 * Require valid JWT in Authorization: Bearer <token>. Sets req.user = { id, username }.
 */
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  const bearerToken = header?.startsWith('Bearer ') ? header.slice(7) : null;
  const cookieToken = req.cookies?.chat_token || null;
  const token = bearerToken || cookieToken;

  if (!token) {
    logger.warn('auth middleware - missing auth token', {
      method: req.method,
      path: req.originalUrl,
    });
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('_id username');
    if (!user) {
      logger.warn('auth middleware - user not found', { userId: decoded.id });
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = { id: user._id.toString(), username: user.username };
    next();
  } catch (err) {
    logger.warn('auth middleware - invalid token', {
      method: req.method,
      path: req.originalUrl,
      error: err.message,
    });
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
