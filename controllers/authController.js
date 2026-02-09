import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

function signToken(user) {
  return jwt.sign(
    { id: user._id, username: user.username },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
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
    const existing = await User.findOne({ username: username.trim().toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'Username already taken' });
    }
    const user = await User.create({ username: username.trim().toLowerCase(), password });
    const token = signToken(user);
    res.status(201).json({
      token,
      user: { id: user._id, username: user.username },
    });
  } catch (err) {
    console.error(err);
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
    const user = await User.findOne({ username: username.trim().toLowerCase() });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    const token = signToken(user);
    res.json({
      token,
      user: { id: user._id, username: user.username },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
}

/**
 * GET /api/auth/me – returns current user (requires auth)
 */
export async function me(req, res) {
  res.json({ user: req.user });
}

