import { beforeAll, beforeEach, afterAll } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer, MongoMemoryReplSet } from 'mongodb-memory-server';

let mongo;
beforeAll(async () => {
  mongo = process.env.HMS_TRANSACTION_TESTS === '1'
    ? await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' }, instanceOpts: [{ launchTimeout: 60000 }] })
    : await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
  await mongoose.connect(mongo.getUri());
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
}, 1200000);
beforeEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})));
});
afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});
