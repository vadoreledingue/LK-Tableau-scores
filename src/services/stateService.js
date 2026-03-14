"use strict";

const fsp = require("fs/promises");
const { DEFAULT_SHARED_STATE, LEGACY_STATE_FILE } = require("../config/appConfig");
const { cleanText, normalizeState } = require("../utils/normalize");

async function tryReadLegacyState() {
  try {
    const raw = await fsp.readFile(LEGACY_STATE_FILE, "utf8");
    return normalizeState(JSON.parse(raw), DEFAULT_SHARED_STATE);
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

  return normalizeState(
    {
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
    },
    DEFAULT_SHARED_STATE
  );
}

function writeStateToDb(db, nextState, options = {}) {
  const { preserveRevision = false } = options;
  const normalized = normalizeState(nextState, DEFAULT_SHARED_STATE);
  const now = new Date().toISOString();
  const getMeta = db.prepare("SELECT value FROM meta WHERE key = ?");
  const setMeta = db.prepare(
    "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  );

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
    const nextUpdatedAt = preserveRevision ? normalized.updatedAt || now : now;

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

module.exports = {
  readStateFromDb,
  writeStateToDb,
  setAdminPasswordInDb,
  ensureInitialData
};
