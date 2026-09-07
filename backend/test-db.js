import "dotenv/config";
import pg from "pg";

const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

try {
  await client.connect();

  console.log("✅ PostgreSQL connection successful!");

  const result = await client.query("SELECT NOW()");
  console.log("Database time:", result.rows[0]);

  await client.end();
} catch (error) {
  console.error("❌ PostgreSQL connection failed:");
  console.error(error);
}
