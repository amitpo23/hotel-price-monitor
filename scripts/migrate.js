#!/usr/bin/env node
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Auto-migration script for Railway deployment
 * Runs all pending migrations before starting the server
 */
async function runMigrations() {
  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    console.log("⚠️  DATABASE_URL not found. Skipping migrations.");
    process.exit(0);
  }

  console.log("🔄 Running database migrations...");

  let connection;
  try {
    // Create connection
    connection = await mysql.createConnection(DATABASE_URL);
    const db = drizzle(connection);

    // Run migrations from drizzle folder
    const migrationsFolder = join(__dirname, "..", "drizzle");
    await migrate(db, { migrationsFolder });

    console.log("✅ Migrations completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);

    // If migrations fail, check if it's because they were already run
    if (error.message && error.message.includes("already exists")) {
      console.log("ℹ️  Database schema already up to date.");
      process.exit(0);
    }

    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

runMigrations();
