import { MongoClient, type Collection } from "mongodb";

import config from "./env.js";

let client: MongoClient | null = null;
let connectPromise: Promise<Collection | null> | null = null;
let indexEnsured = false;

async function connect(): Promise<Collection | null> {
  const { uri, db, collection, retentionDays } = config.logging.mongo;
  if (!uri) return null;

  const mongo = new MongoClient(uri, {
    serverSelectionTimeoutMS: 3000,
    maxPoolSize: 5,
  });

  await mongo.connect();
  client = mongo;
  const coll = mongo.db(db).collection(collection);

  if (!indexEnsured) {
    indexEnsured = true;
    coll
      .createIndex(
        { ts: 1 },
        { expireAfterSeconds: retentionDays * 24 * 60 * 60 },
      )
      .catch(() => {
        indexEnsured = false;
      });
  }

  return coll;
}

export function getLogCollection(): Promise<Collection | null> {
  if (!config.logging.mongo.uri) return Promise.resolve(null);
  if (connectPromise) return connectPromise;

  connectPromise = connect().catch(() => {
    connectPromise = null;
    return null;
  });
  return connectPromise;
}

export async function closeMongo(): Promise<void> {
  if (client) {
    await client.close().catch(() => {});
    client = null;
    connectPromise = null;
    indexEnsured = false;
  }
}
