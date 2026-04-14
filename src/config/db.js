import mongoose from 'mongoose';

import { env } from './env.js';

let listenersRegistered = false;

function registerConnectionListeners() {
  if (listenersRegistered) {
    return;
  }

  mongoose.connection.on('error', (error) => {
    console.error(`MongoDB connection error: ${error.message}`);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected.');
  });

  listenersRegistered = true;
}

export async function connectToDatabase() {
  if (!env.mongoUri.trim()) {
    throw new Error('MONGO_URI is missing in the .env file.');
  }

  registerConnectionListeners();
  mongoose.set('strictQuery', true);

  try {
    await mongoose.connect(env.mongoUri, {
      serverSelectionTimeoutMS: 10000
    });

    console.info('MongoDB connected successfully.');
    console.log('Mongo connected state:', mongoose.connection.readyState);
    return mongoose.connection;
  } catch (error) {
    console.error(`MongoDB connection failed: ${error.message}`);
    throw error;
  }
}

export function isMongoConnected() {
  return mongoose.connection.readyState === 1;
}
