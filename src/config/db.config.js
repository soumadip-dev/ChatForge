import mongoose from 'mongoose';
// import { ENV } from './env.config.js';
import dotenv from 'dotenv';

dotenv.config();


export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');
  } catch (error) {
    console.log('MongoDB connection failed');
    process.exit(1);
  }
};
