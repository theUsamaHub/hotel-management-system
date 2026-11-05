import mongoose from 'mongoose';
import app from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import { startEmailWorker } from './utils/email.js';

try {
  await connectDB();
  const topology = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!topology.setName && topology.msg !== 'isdbgrid') {
    throw Object.assign(new Error('Transactions unavailable'), { code: 'TRANSACTIONS_UNAVAILABLE' });
  }
  // Do not accept inventory writes before unique indexes and collections exist.
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
  const stopEmailWorker = startEmailWorker();
  const server = app.listen(env.PORT, () => console.log(`API listening on port ${env.PORT}`));
  const shutdown = () => {
    stopEmailWorker();
    const timeout = setTimeout(() => process.exit(1), 10000).unref();
    server.close(async () => {
      await mongoose.disconnect();
      clearTimeout(timeout);
      process.exit(0);
    });
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
  server.on('error', () => { console.error('HTTP server failed to start'); process.exit(1); });
} catch (error) {
  console.error(error.code === 'TRANSACTIONS_UNAVAILABLE'
    ? 'Hotel operations require a MongoDB replica set or Atlas. Standalone MongoDB is not supported.'
    : 'Database initialization failed. Check MONGO_URI, database network access and index permissions.');
  process.exit(1);
}
