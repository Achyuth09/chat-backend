import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: [
        'friend_request_received',
        'friend_request_accepted',
        'post_liked',
        'post_commented',
      ],
      required: true,
      index: true,
    },
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
    friendRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'FriendRequest' },
    commentText: { type: String, default: '' },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);
