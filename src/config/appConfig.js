"use strict";

const path = require("path");

const DEFAULT_ADMIN_PASSWORD =
  typeof process.env.ADMIN_PASSWORD_DEFAULT === "string" && process.env.ADMIN_PASSWORD_DEFAULT.trim()
    ? process.env.ADMIN_PASSWORD_DEFAULT.trim()
    : "Kinshima-Admin-2026";

const HOST = process.env.HOST || "0.0.0.0";
const parsedPort = Number(process.env.PORT || 3000);
const PORT = Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 3000;

const MAX_BODY_BYTES = Number.isInteger(Number(process.env.MAX_BODY_BYTES))
  ? Math.max(1024, Number(process.env.MAX_BODY_BYTES))
  : 2 * 1024 * 1024;
const RATE_LIMIT_WINDOW_MS = Number.isInteger(Number(process.env.RATE_LIMIT_WINDOW_MS))
  ? Math.max(1000, Number(process.env.RATE_LIMIT_WINDOW_MS))
  : 60 * 1000;
const MAX_WRITE_REQUESTS_PER_WINDOW = Number.isInteger(Number(process.env.MAX_WRITE_REQUESTS_PER_WINDOW))
  ? Math.max(1, Number(process.env.MAX_WRITE_REQUESTS_PER_WINDOW))
  : 30;
const ACCESS_CONTROL_ALLOW_ORIGIN =
  typeof process.env.ACCESS_CONTROL_ALLOW_ORIGIN === "string" && process.env.ACCESS_CONTROL_ALLOW_ORIGIN.trim()
    ? process.env.ACCESS_CONTROL_ALLOW_ORIGIN.trim()
    : "*";
const ENABLE_REQUEST_LOGS = !["0", "false", "no"].includes(String(process.env.ENABLE_REQUEST_LOGS || "").toLowerCase());
const ENFORCE_ADMIN_WRITE_AUTH = ["1", "true", "yes"].includes(
  String(process.env.ENFORCE_ADMIN_WRITE_AUTH || "").toLowerCase()
);

const APP_ROOT = path.resolve(__dirname, "..", "..");
const STATIC_DIR = path.join(APP_ROOT, "public");
const DATA_DIR = path.join(APP_ROOT, "data");
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
  adminPassword: DEFAULT_ADMIN_PASSWORD,
  revision: 0,
  updatedAt: null
};

module.exports = {
  HOST,
  PORT,
  MAX_BODY_BYTES,
  RATE_LIMIT_WINDOW_MS,
  MAX_WRITE_REQUESTS_PER_WINDOW,
  ACCESS_CONTROL_ALLOW_ORIGIN,
  ENABLE_REQUEST_LOGS,
  ENFORCE_ADMIN_WRITE_AUTH,
  APP_ROOT,
  STATIC_DIR,
  DATA_DIR,
  DB_FILE,
  LEGACY_STATE_FILE,
  CONTENT_TYPES,
  DEFAULT_SHARED_STATE
};
