"use strict";

const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { URL } = require("url");

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 8080);
const ROOT_DIR = process.cwd();
const DATA_DIR = path.join(ROOT_DIR, "data");
const STATE_FILE = path.join(DATA_DIR, "shared-state.json");

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
  adminPassword: "Kinshima-Admin-2026"
};

async function ensureStateFile() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  try {
    await fsp.access(STATE_FILE, fs.constants.F_OK);
  } catch {
    await writeJsonFile(STATE_FILE, DEFAULT_SHARED_STATE);
  }
}

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

async function readState() {
  await ensureStateFile();
  try {
    const raw = await fsp.readFile(STATE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return normalizeState(parsed);
  } catch {
    return { ...DEFAULT_SHARED_STATE };
  }
}

function normalizeState(input) {
  const state = input && typeof input === "object" ? input : {};
  return {
    entries: Array.isArray(state.entries) ? state.entries : [],
    teams: Array.isArray(state.teams) ? state.teams : [],
    categories: Array.isArray(state.categories) ? state.categories : [],
    tags: Array.isArray(state.tags) ? state.tags : [],
    teamStyles: state.teamStyles && typeof state.teamStyles === "object" ? state.teamStyles : {},
    adminPassword: typeof state.adminPassword === "string" && state.adminPassword.trim()
      ? state.adminPassword.trim()
      : DEFAULT_SHARED_STATE.adminPassword
  };
}

async function writeJsonFile(filePath, payload) {
  const tempFile = `${filePath}.tmp`;
  await fsp.writeFile(tempFile, JSON.stringify(payload, null, 2), "utf8");
  await fsp.rename(tempFile, filePath);
}

async function writeState(nextState) {
  const normalized = normalizeState(nextState);
  await writeJsonFile(STATE_FILE, normalized);
  return normalized;
}

async function handleApi(req, res, pathname) {
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
      const state = await readState();
      sendJson(res, 200, {
        entries: state.entries,
        teams: state.teams,
        categories: state.categories,
        tags: state.tags,
        teamStyles: state.teamStyles
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
      const current = await readState();
      const merged = {
        ...current,
        entries: Array.isArray(body.entries) ? body.entries : current.entries,
        teams: Array.isArray(body.teams) ? body.teams : current.teams,
        categories: Array.isArray(body.categories) ? body.categories : current.categories,
        tags: Array.isArray(body.tags) ? body.tags : current.tags,
        teamStyles: body.teamStyles && typeof body.teamStyles === "object" ? body.teamStyles : current.teamStyles
      };
      const saved = await writeState(merged);
      sendJson(res, 200, {
        ok: true,
        entries: saved.entries,
        teams: saved.teams,
        categories: saved.categories,
        tags: saved.tags,
        teamStyles: saved.teamStyles
      });
      return;
    }
    sendText(res, 405, "Method Not Allowed");
    return;
  }

  if (pathname === "/api/admin-password") {
    if (req.method === "GET") {
      const state = await readState();
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
      const current = await readState();
      const saved = await writeState({
        ...current,
        adminPassword: nextPassword
      });
      sendJson(res, 200, { ok: true, password: saved.adminPassword });
      return;
    }
    sendText(res, 405, "Method Not Allowed");
    return;
  }

  notFound(res);
}

function safeJoin(base, target) {
  const targetPath = path.normalize(path.join(base, target));
  if (!targetPath.startsWith(base)) return null;
  return targetPath;
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

async function requestHandler(req, res) {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const pathname = decodeURIComponent(url.pathname);
    if (pathname.startsWith("/api/")) {
      await handleApi(req, res, pathname);
      return;
    }
    await handleStatic(req, res, pathname);
  } catch (error) {
    sendJson(res, 500, { error: String(error.message || "server-error") });
  }
}

ensureStateFile()
  .then(() => {
    const server = http.createServer((req, res) => {
      requestHandler(req, res);
    });
    server.listen(PORT, HOST, () => {
      console.log(`Kinshima server running on http://${HOST}:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });
