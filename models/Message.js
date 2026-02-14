import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    roomId: { type: String, required: true },
    sender: { type: String, required: true },
    text: { type: String, default: '' },
    attachments: {
      type: [
        {
          url: { type: String, required: true },
          publicId: { type: String, default: '' },
          type: { type: String, default: 'raw' },
          width: { type: Number, default: null },
          height: { type: Number, default: null },
          duration: { type: Number, default: null },
          name: { type: String, default: '' },
        },
      ],
      default: [],
    },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model('Message', messageSchema);
