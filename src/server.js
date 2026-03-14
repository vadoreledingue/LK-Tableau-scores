"use strict";

const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { URL } = require("url");

const {
  HOST,
  PORT,
  ENABLE_REQUEST_LOGS,
  STATIC_DIR,
  DB_FILE,
  CONTENT_TYPES
} = require("./config/appConfig");
const { sendJson, notFound } = require("./utils/http");
const {
  applySecurityHeaders,
  createRequestId,
  getClientIp,
  logRequest
} = require("./utils/security");
const { createDatabase, ensureDataDir } = require("./db/database");
const {
  readStateFromDb,
  writeStateToDb,
  setAdminPasswordInDb,
  ensureInitialData
} = require("./services/stateService");
const { createApiHandler } = require("./routes/api");

const handleApi = createApiHandler({
  readStateFromDb,
  writeStateToDb,
  setAdminPasswordInDb
});

function safeJoin(base, target) {
  const targetPath = path.normalize(path.join(base, target));
  if (!targetPath.startsWith(base)) return null;
  return targetPath;
}

async function handleStatic(req, res, pathname) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const resolved = safeJoin(STATIC_DIR, requestedPath);
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
  const requestId = createRequestId();
  const startTime = Date.now();
  let pathnameForLogs = req.url || "/";

  try {
    applySecurityHeaders(res);
    res.setHeader("X-Request-Id", requestId);

    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const pathname = decodeURIComponent(url.pathname);
    pathnameForLogs = pathname;

    if (pathname.startsWith("/api/")) {
      await handleApi(db, req, res, pathname);
      logRequest({
        enabled: ENABLE_REQUEST_LOGS,
        requestId,
        method: req.method || "GET",
        pathname,
        statusCode: res.statusCode,
        elapsedMs: Date.now() - startTime,
        clientIp: getClientIp(req)
      });
      return;
    }

    await handleStatic(req, res, pathname);
    logRequest({
      enabled: ENABLE_REQUEST_LOGS,
      requestId,
      method: req.method || "GET",
      pathname,
      statusCode: res.statusCode,
      elapsedMs: Date.now() - startTime,
      clientIp: getClientIp(req)
    });
  } catch (error) {
    sendJson(res, 500, { error: "internal-error" });
    logRequest({
      enabled: ENABLE_REQUEST_LOGS,
      requestId,
      method: req.method || "GET",
      pathname: pathnameForLogs,
      statusCode: 500,
      elapsedMs: Date.now() - startTime,
      clientIp: getClientIp(req)
    });
    console.error("Server request error:", error.message || error);
  }
}

async function start() {
  await ensureDataDir();
  const db = createDatabase();
  await ensureInitialData(db);

  const server = http.createServer((req, res) => {
    requestHandler(db, req, res);
  });

  server.listen(PORT, HOST, () => {
    console.log(`Kinshima server running on http://${HOST}:${PORT}`);
    console.log(`SQLite database: ${DB_FILE}`);
    console.log(`Static root: ${STATIC_DIR}`);
  });
}

if (require.main === module) {
  start().catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });
}

module.exports = {
  start
};
