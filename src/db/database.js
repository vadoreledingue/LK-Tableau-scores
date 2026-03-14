"use strict";

const fsp = require("fs/promises");
const { DB_FILE, DATA_DIR, DEFAULT_SHARED_STATE } = require("../config/appConfig");

let Database;
try {
  Database = require("better-sqlite3");
} catch {
  console.error("Missing dependency: better-sqlite3");
  console.error("Run: npm install");
  process.exit(1);
}

function createDatabase() {
  const db = new Database(DB_FILE);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS teams (
      position INTEGER NOT NULL,
      name TEXT PRIMARY KEY,
      color TEXT NOT NULL DEFAULT '',
      logo TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS categories (
      position INTEGER NOT NULL,
      name TEXT PRIMARY KEY
    );

    CREATE TABLE IF NOT EXISTS tags (
      position INTEGER NOT NULL,
      name TEXT PRIMARY KEY
    );

    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY,
      season TEXT NOT NULL,
      team TEXT NOT NULL,
      category TEXT NOT NULL,
      tag TEXT NOT NULL,
      score INTEGER NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      occurred_at TEXT NOT NULL
    );
  `);

  const insertMeta = db.prepare("INSERT OR IGNORE INTO meta (key, value) VALUES (?, ?)");
  insertMeta.run("adminPassword", DEFAULT_SHARED_STATE.adminPassword);
  insertMeta.run("revision", "0");
  insertMeta.run("updatedAt", "");

  return db;
}

async function ensureDataDir() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
}

module.exports = {
  createDatabase,
  ensureDataDir
};
