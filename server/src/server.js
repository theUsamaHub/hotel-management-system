import mongoose from 'mongoose';
import app from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import { startEmailWorker } from './utils/email.js';
import { startupError } from './utils/startupError.js';

let stage = 'database connection';
try {
  await connectDB();
  stage = 'transaction capability check';
  const topology = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!topology.setName && topology.msg !== 'isdbgrid') {
    throw Object.assign(new Error('Transactions unavailable'), { code: 'TRANSACTIONS_UNAVAILABLE' });
  }
  // Do not accept inventory writes before unique indexes and collections exist.
  stage = 'collection and index initialization';
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
  stage = 'email worker initialization';
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
  server.on('error', (error) => { console.error(error.code === 'EADDRINUSE' ? `API port ${env.PORT} is already in use. Stop the duplicate server or configure a different port and proxy target.` : 'HTTP server failed to start'); process.exit(1); });
} catch (error) {
  console.error(startupError(error, stage));
  process.exit(1);
}
