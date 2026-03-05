"use strict";

const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { URL } = require("url");

let Database;
try {
  Database = require("better-sqlite3");
} catch {
  console.error("Missing dependency: better-sqlite3");
  console.error("Run: npm install");
  process.exit(1);
}

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = process.cwd();
const DATA_DIR = path.join(ROOT_DIR, "data");
const DB_FILE = path.join(DATA_DIR, "kinshima.sqlite");
const LEGACY_STATE_FILE = path.join(DATA_DIR, "shared-state.json");

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8"
};

const DEFAULT_SHARED_STATE = {
  entries: [],
  teams: [],
  categories: [],
  tags: [],
  teamStyles: {},
  adminPassword: "Kinshima-Admin-2026",
  revision: 0,
  updatedAt: null
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*"
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, message) {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Access-Control-Allow-Origin": "*"
  });
  res.end(message);
}

function notFound(res) {
  sendText(res, 404, "Not Found");
}

async function readBodyJson(req) {
  const maxBytes = 2 * 1024 * 1024;
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > maxBytes) {
      throw new Error("payload-too-large");
    }
  }
  return JSON.parse(raw || "{}");
}

function normalizeState(input) {
  const state = input && typeof input === "object" ? input : {};
  return {
    entries: Array.isArray(state.entries)
      ? state.entries.map((entry) => normalizeEntry(entry))
      : [],
    teams: Array.isArray(state.teams) ? unique(state.teams.map(cleanText).filter(Boolean)) : [],
    categories: Array.isArray(state.categories) ? unique(state.categories.map(cleanText).filter(Boolean)) : [],
    tags: Array.isArray(state.tags) ? unique(state.tags.map(cleanText).filter(Boolean)) : [],
    teamStyles: state.teamStyles && typeof state.teamStyles === "object" ? state.teamStyles : {},
    adminPassword: typeof state.adminPassword === "string" && state.adminPassword.trim()
      ? state.adminPassword.trim()
      : DEFAULT_SHARED_STATE.adminPassword,
    revision: Number.isInteger(state.revision) && state.revision >= 0 ? state.revision : 0,
    updatedAt: typeof state.updatedAt === "string" && state.updatedAt.trim() ? state.updatedAt : null
  };
}

function normalizeEntry(entry) {
  const raw = entry && typeof entry === "object" ? entry : {};
  return {
    id: cleanText(raw.id) || `res-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
    season: cleanText(raw.season),
    team: cleanText(raw.team),
    category: cleanText(raw.category),
    tag: cleanText(raw.tag) || "Sans tag",
    score: Number.isFinite(Number(raw.score)) ? Math.max(0, Math.floor(Number(raw.score))) : 0,
    note: typeof raw.note === "string" ? raw.note : "",
    occurredAt: cleanText(raw.occurredAt || raw.occurred_at || raw.date)
  };
}

function cleanText(value) {
  return String(value || "").trim();
}

function unique(items) {
  return Array.from(new Set(items));
}

function safeJoin(base, target) {
  const targetPath = path.normalize(path.join(base, target));
  if (!targetPath.startsWith(base)) return null;
  return targetPath;
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

async function tryReadLegacyState() {
  try {
    const raw = await fsp.readFile(LEGACY_STATE_FILE, "utf8");
    return normalizeState(JSON.parse(raw));
  } catch {
    return null;
  }
}

function readStateFromDb(db) {
  const entriesRows = db
    .prepare("SELECT id, season, team, category, tag, score, note, occurred_at FROM entries ORDER BY occurred_at DESC, rowid DESC")
    .all();
  const teamsRows = db.prepare("SELECT name, color, logo FROM teams ORDER BY position ASC, rowid ASC").all();
  const categoriesRows = db.prepare("SELECT name FROM categories ORDER BY position ASC, rowid ASC").all();
  const tagsRows = db.prepare("SELECT name FROM tags ORDER BY position ASC, rowid ASC").all();
  const metaRows = db.prepare("SELECT key, value FROM meta").all();

  const meta = {};
  for (const row of metaRows) meta[row.key] = row.value;

  const teamStyles = {};
  for (const row of teamsRows) {
    teamStyles[row.name] = {
      color: row.color || "",
      logo: row.logo || ""
    };
  }

  return normalizeState({
    entries: entriesRows.map((row) => ({
      id: row.id,
      season: row.season,
      team: row.team,
      category: row.category,
      tag: row.tag,
      score: row.score,
      note: row.note,
      occurredAt: row.occurred_at
    })),
    teams: teamsRows.map((row) => row.name),
    categories: categoriesRows.map((row) => row.name),
    tags: tagsRows.map((row) => row.name),
    teamStyles,
    adminPassword: meta.adminPassword || DEFAULT_SHARED_STATE.adminPassword,
    revision: Number(meta.revision || 0),
    updatedAt: meta.updatedAt || null
  });
}

function writeStateToDb(db, nextState, options = {}) {
  const { preserveRevision = false } = options;
  const normalized = normalizeState(nextState);
  const now = new Date().toISOString();
  const getMeta = db.prepare("SELECT value FROM meta WHERE key = ?");
  const setMeta = db.prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");

  const transaction = db.transaction(() => {
    db.prepare("DELETE FROM entries").run();
    db.prepare("DELETE FROM teams").run();
    db.prepare("DELETE FROM categories").run();
    db.prepare("DELETE FROM tags").run();

    const insertEntry = db.prepare(`
      INSERT INTO entries (id, season, team, category, tag, score, note, occurred_at)
      VALUES (@id, @season, @team, @category, @tag, @score, @note, @occurredAt)
    `);
    normalized.entries.forEach((entry) => insertEntry.run(entry));

    const insertTeam = db.prepare("INSERT INTO teams (position, name, color, logo) VALUES (?, ?, ?, ?)");
    normalized.teams.forEach((team, index) => {
      const style = normalized.teamStyles[team] || {};
      insertTeam.run(index, team, cleanText(style.color), cleanText(style.logo));
    });

    const insertCategory = db.prepare("INSERT INTO categories (position, name) VALUES (?, ?)");
    normalized.categories.forEach((value, index) => insertCategory.run(index, value));

    const insertTag = db.prepare("INSERT INTO tags (position, name) VALUES (?, ?)");
    normalized.tags.forEach((value, index) => insertTag.run(index, value));

    const currentRevision = Number((getMeta.get("revision") || {}).value || 0);
    const nextRevision = preserveRevision ? normalized.revision : currentRevision + 1;
    const nextUpdatedAt = preserveRevision ? (normalized.updatedAt || now) : now;

    setMeta.run("adminPassword", normalized.adminPassword);
    setMeta.run("revision", String(nextRevision));
    setMeta.run("updatedAt", nextUpdatedAt);

    normalized.revision = nextRevision;
    normalized.updatedAt = nextUpdatedAt;
  });

  transaction();
  return normalized;
}

function setAdminPasswordInDb(db, password) {
  db.prepare(
    "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run("adminPassword", password);
}

async function ensureInitialData(db) {
  const state = readStateFromDb(db);
  const isEmpty = !state.entries.length && !state.teams.length && !state.categories.length && !state.tags.length;
  if (!isEmpty) return;

  const legacy = await tryReadLegacyState();
  if (!legacy) {
    writeStateToDb(db, DEFAULT_SHARED_STATE, { preserveRevision: true });
    return;
  }
  writeStateToDb(db, legacy, { preserveRevision: true });
}

async function handleApi(db, req, res, pathname) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    res.end();
    return;
  }

  if (pathname === "/api/results") {
    if (req.method === "GET") {
      const state = readStateFromDb(db);
      sendJson(res, 200, {
        entries: state.entries,
        teams: state.teams,
        categories: state.categories,
        tags: state.tags,
        teamStyles: state.teamStyles,
        revision: state.revision,
        updatedAt: state.updatedAt
      });
      return;
    }

    if (req.method === "PUT") {
      let body;
      try {
        body = await readBodyJson(req);
      } catch (error) {
        sendJson(res, 400, { error: String(error.message || "invalid-json") });
        return;
      }

      try {
        const current = readStateFromDb(db);
        const hasExpectedRevision = Object.prototype.hasOwnProperty.call(body, "revision");
        const expectedRevision = Number(body.revision);
        if (hasExpectedRevision && (!Number.isInteger(expectedRevision) || expectedRevision !== current.revision)) {
          sendJson(res, 409, {
            error: "revision-conflict",
            currentRevision: current.revision
          });
          return;
        }

        const merged = {
          ...current,
          entries: Array.isArray(body.entries) ? body.entries : current.entries,
          teams: Array.isArray(body.teams) ? body.teams : current.teams,
          categories: Array.isArray(body.categories) ? body.categories : current.categories,
          tags: Array.isArray(body.tags) ? body.tags : current.tags,
          teamStyles: body.teamStyles && typeof body.teamStyles === "object" ? body.teamStyles : current.teamStyles,
          adminPassword: current.adminPassword
        };

        const saved = writeStateToDb(db, merged, { preserveRevision: false });
        sendJson(res, 200, {
          ok: true,
          entries: saved.entries,
          teams: saved.teams,
          categories: saved.categories,
          tags: saved.tags,
          teamStyles: saved.teamStyles,
          revision: saved.revision,
          updatedAt: saved.updatedAt
        });
        return;
      } catch (error) {
        sendJson(res, 500, { error: String(error.message || "db-write-error") });
        return;
      }
    }

    sendText(res, 405, "Method Not Allowed");
    return;
  }

  if (pathname === "/api/admin-password") {
    if (req.method === "GET") {
      const state = readStateFromDb(db);
      sendJson(res, 200, { password: state.adminPassword });
      return;
    }
    if (req.method === "PUT") {
      let body;
      try {
        body = await readBodyJson(req);
      } catch (error) {
        sendJson(res, 400, { error: String(error.message || "invalid-json") });
        return;
      }
      const nextPassword = typeof body.password === "string" ? body.password.trim() : "";
      if (!nextPassword) {
        sendJson(res, 400, { error: "password-required" });
        return;
      }

      try {
        setAdminPasswordInDb(db, nextPassword);
        sendJson(res, 200, { ok: true, password: nextPassword });
        return;
      } catch (error) {
        sendJson(res, 500, { error: String(error.message || "db-write-error") });
        return;
      }
    }
    sendText(res, 405, "Method Not Allowed");
    return;
  }

  notFound(res);
}

async function handleStatic(req, res, pathname) {
  let filePath = pathname === "/" ? "/index.html" : pathname;
  const resolved = safeJoin(ROOT_DIR, filePath);
  if (!resolved) {
    notFound(res);
    return;
  }

  try {
    let stat = await fsp.stat(resolved);
    let finalPath = resolved;
    if (stat.isDirectory()) {
      finalPath = path.join(resolved, "index.html");
      stat = await fsp.stat(finalPath);
    }

    const ext = path.extname(finalPath).toLowerCase();
    const contentType = CONTENT_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": stat.size
    });
    fs.createReadStream(finalPath).pipe(res);
  } catch {
    notFound(res);
  }
}

async function requestHandler(db, req, res) {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const pathname = decodeURIComponent(url.pathname);
    if (pathname.startsWith("/api/")) {
      await handleApi(db, req, res, pathname);
      return;
    }
    await handleStatic(req, res, pathname);
  } catch (error) {
    sendJson(res, 500, { error: String(error.message || "server-error") });
  }
}

async function start() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  const db = createDatabase();
  await ensureInitialData(db);

  const server = http.createServer((req, res) => {
    requestHandler(db, req, res);
  });

  server.listen(PORT, HOST, () => {
    console.log(`Kinshima server running on http://${HOST}:${PORT}`);
    console.log(`SQLite database: ${DB_FILE}`);
  });
}

start().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
