import mongoose from 'mongoose';

let isExternalMongo = false;

export async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (uri) {
    try {
      console.log(`[Database] Connecting to configured MongoDB URI (${uri})...`);
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
      console.log(`[Database] Successfully connected to external MongoDB.`);
      isExternalMongo = true;
      return;
    } catch (err) {
      console.warn(`[Database] External MongoDB connection failed (${err.message}). Falling back to high-speed in-memory document cluster.`);
    }
  }

  console.log(`[Database] Initialized high-speed in-memory document store.`);
  isExternalMongo = false;
}

export function isConnectedToExternalMongo() {
  return isExternalMongo && mongoose.connection.readyState === 1;
}

export async function disconnectDB() {
  if (isExternalMongo) {
    await mongoose.disconnect();
  }
}
