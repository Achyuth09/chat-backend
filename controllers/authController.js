import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { logger } from '../utils/logger.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const TOKEN_COOKIE = 'chat_token';
const TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function signToken(user) {
  return jwt.sign(
    { id: user._id, username: user.username },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function tokenCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: TOKEN_MAX_AGE_MS,
  };
}

function attachTokenCookie(res, token) {
  res.cookie(TOKEN_COOKIE, token, tokenCookieOptions());
}

/**
 * POST /api/auth/signup – body: { username, password }
 */
export async function signup(req, res) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const normalizedUsername = username.trim().toLowerCase();
    const existing = await User.findOne({ username: normalizedUsername });
    if (existing) {
      logger.warn('signup rejected - username exists', { username: normalizedUsername });
      return res.status(409).json({ error: 'Username already taken' });
    }

    const user = await User.create({ username: normalizedUsername, password });
    const token = signToken(user);
    attachTokenCookie(res, token);

    logger.info('signup success', { userId: user._id.toString(), username: user.username });
    res.status(201).json({
      token,
      user: { id: user._id, username: user.username },
    });
  } catch (err) {
    logger.error('signup failed', { error: err.message });
    res.status(500).json({ error: 'Signup failed' });
  }
}

/**
 * POST /api/auth/login – body: { username, password }
 */
export async function login(req, res) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const normalizedUsername = username.trim().toLowerCase();
    const user = await User.findOne({ username: normalizedUsername });
    if (!user || !(await user.comparePassword(password))) {
      logger.warn('login rejected - invalid credentials', { username: normalizedUsername });
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = signToken(user);
    attachTokenCookie(res, token);
    logger.info('login success', { userId: user._id.toString(), username: user.username });

    res.json({
      token,
      user: { id: user._id, username: user.username },
    });
  } catch (err) {
    logger.error('login failed', { error: err.message });
    res.status(500).json({ error: 'Login failed' });
  }
}

/**
 * GET /api/auth/me – returns current user (requires auth)
 */
export async function me(req, res) {
  res.json({ user: req.user });
}

/**
 * POST /api/auth/logout – clears auth cookie
 */
export async function logout(req, res) {
  res.clearCookie(TOKEN_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  logger.info('logout success', { username: req.user?.username });
  res.json({ ok: true });
}

