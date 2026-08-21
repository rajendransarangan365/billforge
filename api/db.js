const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://sarangan365:pass2711@mining365.uesno9a.mongodb.net/billforge?retryWrites=true&w=majority";

let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = new MongoClient(MONGODB_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
  });

  await client.connect();
  const db = client.db('billforge');

  cachedClient = client;
  cachedDb = db;

  return { client, db };
}

module.exports = { connectToDatabase };
