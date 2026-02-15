import mongoose from 'mongoose';
import Post from '../models/Post.js';
import FriendRequest from '../models/FriendRequest.js';
import { logger } from '../utils/logger.js';
import { createNotification } from '../services/notificationService.js';

function mapMedia(media = []) {
  return media.map((item) => ({
    url: item.url,
    publicId: item.publicId,
    type: item.type,
    width: item.width || null,
    height: item.height || null,
    duration: item.duration || null,
    originalName: item.originalName || null,
  }));
}

function toCommentDto(comment) {
  const author = comment.author || {};
  return {
    id: comment._id.toString(),
    text: comment.text,
    createdAt: comment.createdAt,
    author: {
      id: author._id?.toString?.() || '',
      username: author.username || '',
      avatarUrl: author.avatarUrl || '',
    },
  };
}

function toPostDto(post) {
  const author = post.author || {};
  return {
    id: post._id.toString(),
    caption: post.caption || '',
    media: mapMedia(post.media),
    author: {
      id: author._id?.toString?.() || '',
      username: author.username || '',
      avatarUrl: author.avatarUrl || '',
    },
    likesCount: Array.isArray(post.likes) ? post.likes.length : 0,
    likedByMe: false,
    commentsCount: Array.isArray(post.comments) ? post.comments.length : 0,
    comments: (post.comments || []).slice(-10).map(toCommentDto),
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}

export async function listPosts(req, res) {
  try {
    const limit = Math.min(Number(req.query.limit || 20), 50);
    const page = Math.max(Number(req.query.page || 1), 1);
    const skip = (page - 1) * limit;
    const accepted = await FriendRequest.find({
      status: 'accepted',
      $or: [{ from: req.user.id }, { to: req.user.id }],
    })
      .select('from to')
      .lean();

    const friendIds = accepted
      .map((fr) => {
        const from = fr.from?.toString?.() || '';
        const to = fr.to?.toString?.() || '';
        return from === req.user.id ? to : from;
      })
      .filter(Boolean);

    const visibleAuthorIds = [req.user.id, ...friendIds];

    const posts = await Post.find({ author: { $in: visibleAuthorIds } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('author', '_id username avatarUrl')
      .populate('comments.author', '_id username avatarUrl')
      .lean();

    const items = posts.map((post) => {
      const dto = toPostDto(post);
      dto.likedByMe = (post.likes || []).some((id) => id.toString() === req.user.id);
      return dto;
    });

    res.json({ items, page, limit });
  } catch (err) {
    logger.error('list posts failed', { by: req.user?.username, error: err.message });
    res.status(500).json({ error: 'Failed to load feed' });
  }
}

export async function createPost(req, res) {
  try {
    const caption = String(req.body?.caption || '').trim();
    const media = Array.isArray(req.body?.media) ? req.body.media : [];
    if (!caption && media.length === 0) {
      return res.status(400).json({ error: 'caption or media is required' });
    }

    const post = await Post.create({
      author: req.user.id,
      caption,
      media: mapMedia(media),
    });

    const hydrated = await Post.findById(post._id)
      .populate('author', '_id username avatarUrl')
      .populate('comments.author', '_id username avatarUrl')
      .lean();
    const dto = toPostDto(hydrated);
    dto.likedByMe = false;

    logger.info('post created', { by: req.user.username, postId: post._id.toString() });
    res.status(201).json(dto);
  } catch (err) {
    logger.error('create post failed', { by: req.user?.username, error: err.message });
    res.status(500).json({ error: 'Failed to create post' });
  }
}

export async function getPostById(req, res) {
  try {
    const { postId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ error: 'Invalid post id' });
    }
    const post = await Post.findById(postId)
      .populate('author', '_id username avatarUrl')
      .populate('comments.author', '_id username avatarUrl')
      .lean();
    if (!post) return res.status(404).json({ error: 'Post not found' });
    const dto = toPostDto(post);
    dto.likedByMe = (post.likes || []).some((id) => id.toString() === req.user.id);
    res.json(dto);
  } catch (err) {
    logger.error('get post failed', { by: req.user?.username, error: err.message });
    res.status(500).json({ error: 'Failed to fetch post' });
  }
}

export async function deletePost(req, res) {
  try {
    const { postId } = req.params;
    const post = await Post.findById(postId).select('_id author').lean();
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.author.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Only owner can delete this post' });
    }
    await Post.deleteOne({ _id: postId });
    res.json({ ok: true });
  } catch (err) {
    logger.error('delete post failed', { by: req.user?.username, error: err.message });
    res.status(500).json({ error: 'Failed to delete post' });
  }
}

export async function toggleLike(req, res) {
  try {
    const { postId } = req.params;
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const idx = post.likes.findIndex((id) => id.toString() === req.user.id);
    let likedByMe = false;
    if (idx >= 0) {
      post.likes.splice(idx, 1);
      likedByMe = false;
    } else {
      post.likes.push(req.user.id);
      likedByMe = true;
      await createNotification({
        recipient: post.author.toString(),
        actor: req.user.id,
        type: 'post_liked',
        post: post._id.toString(),
      });
    }
    await post.save();
    res.json({ likesCount: post.likes.length, likedByMe });
  } catch (err) {
    logger.error('toggle like failed', { by: req.user?.username, error: err.message });
    res.status(500).json({ error: 'Failed to update like' });
  }
}

export async function addComment(req, res) {
  try {
    const { postId } = req.params;
    const text = String(req.body?.text || '').trim();
    if (!text) return res.status(400).json({ error: 'text is required' });

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    post.comments.push({ author: req.user.id, text });
    await post.save();
    await createNotification({
      recipient: post.author.toString(),
      actor: req.user.id,
      type: 'post_commented',
      post: post._id.toString(),
      commentText: text,
    });

    const hydrated = await Post.findById(post._id)
      .populate('author', '_id username avatarUrl')
      .populate('comments.author', '_id username avatarUrl')
      .lean();

    const latestComment = hydrated.comments[hydrated.comments.length - 1];
    res.status(201).json({
      comment: toCommentDto(latestComment),
      commentsCount: hydrated.comments.length,
    });
  } catch (err) {
    logger.error('add comment failed', { by: req.user?.username, error: err.message });
    res.status(500).json({ error: 'Failed to add comment' });
  }
}

/**
 * GET /api/posts/me – list current user's posts.
 */
export async function listMyPosts(req, res) {
  try {
    const posts = await Post.find({ author: req.user.id })
      .sort({ createdAt: -1 })
      .populate('author', '_id username avatarUrl')
      .populate('comments.author', '_id username avatarUrl')
      .lean();

    const items = posts.map((post) => {
      const dto = toPostDto(post);
      dto.likedByMe = (post.likes || []).some((id) => id.toString() === req.user.id);
      return dto;
    });
    res.json({ items });
  } catch (err) {
    logger.error('list my posts failed', { by: req.user?.username, error: err.message });
    res.status(500).json({ error: 'Failed to load your posts' });
  }
}
