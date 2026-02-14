import mongoose from 'mongoose';

export async function connectDB() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/chat';
  await mongoose.connect(mongoUri);
  console.log('MongoDB connected');
}
