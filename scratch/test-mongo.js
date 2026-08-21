const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://sarangan365:pass2711@mining365.uesno9a.mongodb.net/billforge?retryWrites=true&w=majority";

async function testConn() {
  const client = new MongoClient(uri);
  try {
    console.log("Connecting to MongoDB Atlas...");
    await client.connect();
    console.log("Connected successfully!");
    const db = client.db('billforge');
    const collections = await db.listCollections().toArray();
    console.log("Collections in billforge db:", collections.map(c => c.name));
  } catch (err) {
    console.error("MongoDB Connection Error:", err);
  } finally {
    await client.close();
  }
}

testConn();
