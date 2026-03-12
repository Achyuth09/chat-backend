import mongoose from 'mongoose';

export async function connectDB() {
  const mongoUri = process.env.MONGODB_URI;
  await mongoose.connect(mongoUri);
  console.log('MongoDB connected');
}
