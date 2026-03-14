"use strict";

const { sendJson, sendText, notFound, readBodyJson } = require("../utils/http");
const {
  MAX_BODY_BYTES,
  RATE_LIMIT_WINDOW_MS,
  MAX_WRITE_REQUESTS_PER_WINDOW,
  ENFORCE_ADMIN_WRITE_AUTH,
  ACCESS_CONTROL_ALLOW_ORIGIN
} = require("../config/appConfig");
const { constantTimeEqual, createWriteRateLimiter, getClientIp } = require("../utils/security");
const { validateResultsPatch, validatePasswordUpdate } = require("../utils/validators");

const writeLimiter = createWriteRateLimiter({
  windowMs: RATE_LIMIT_WINDOW_MS,
  maxRequests: MAX_WRITE_REQUESTS_PER_WINDOW
});

function getCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": ACCESS_CONTROL_ALLOW_ORIGIN,
    "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Admin-Password"
  };
}

function extractAuthPassword(req) {
  const direct = typeof req.headers["x-admin-password"] === "string" ? req.headers["x-admin-password"].trim() : "";
  if (direct) return direct;

  const authorization = typeof req.headers.authorization === "string" ? req.headers.authorization.trim() : "";
  if (!authorization) return "";
  const [scheme, token] = authorization.split(/\s+/, 2);
  if (scheme && scheme.toLowerCase() === "bearer" && token) return token.trim();
  return "";
}

function checkWriteAuthorization(req, currentPassword) {
  if (!ENFORCE_ADMIN_WRITE_AUTH) return true;
  const supplied = extractAuthPassword(req);
  if (!supplied) return false;
  return constantTimeEqual(supplied, currentPassword);
}

function checkWriteRateLimit(req, pathname, res) {
  const ip = getClientIp(req);
  const key = `${ip}:${pathname}`;
  const result = writeLimiter.allow(key);
  if (result.allowed) return true;

  sendJson(
    res,
    429,
    {
      error: "rate-limit",
      retryAfterSeconds: result.retryAfterSeconds
    },
    {
      ...getCorsHeaders(),
      "Retry-After": String(result.retryAfterSeconds)
    }
  );
  return false;
}

function createApiHandler(stateService) {
  const { readStateFromDb, writeStateToDb, setAdminPasswordInDb } = stateService;

  return async function handleApi(db, req, res, pathname) {
    if (req.method === "OPTIONS") {
      res.writeHead(204, getCorsHeaders());
      res.end();
      return;
    }

    if (pathname === "/api/results") {
      if (req.method === "GET") {
        const state = readStateFromDb(db);
        sendJson(
          res,
          200,
          {
            entries: state.entries,
            teams: state.teams,
            categories: state.categories,
            tags: state.tags,
            teamStyles: state.teamStyles,
            revision: state.revision,
            updatedAt: state.updatedAt
          },
          getCorsHeaders()
        );
        return;
      }

      if (req.method === "PUT") {
        if (!checkWriteRateLimit(req, pathname, res)) return;

        const current = readStateFromDb(db);
        if (!checkWriteAuthorization(req, current.adminPassword)) {
          sendJson(res, 401, { error: "admin-auth-required" }, getCorsHeaders());
          return;
        }

        let body;
        try {
          body = await readBodyJson(req, MAX_BODY_BYTES);
        } catch {
          sendJson(res, 400, { error: "invalid-json" }, getCorsHeaders());
          return;
        }

        const validation = validateResultsPatch(body);
        if (!validation.ok) {
          sendJson(res, 400, { error: validation.error }, getCorsHeaders());
          return;
        }

        try {
          const hasExpectedRevision = Object.prototype.hasOwnProperty.call(body, "revision");
          const expectedRevision = Number(body.revision);
          if (hasExpectedRevision && (!Number.isInteger(expectedRevision) || expectedRevision !== current.revision)) {
            sendJson(
              res,
              409,
              {
                error: "revision-conflict",
                currentRevision: current.revision
              },
              getCorsHeaders()
            );
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
          sendJson(
            res,
            200,
            {
              ok: true,
              entries: saved.entries,
              teams: saved.teams,
              categories: saved.categories,
              tags: saved.tags,
              teamStyles: saved.teamStyles,
              revision: saved.revision,
              updatedAt: saved.updatedAt
            },
            getCorsHeaders()
          );
          return;
        } catch {
          sendJson(res, 500, { error: "db-write-error" }, getCorsHeaders());
          return;
        }
      }

      sendText(res, 405, "Method Not Allowed", getCorsHeaders());
      return;
    }

    if (pathname === "/api/admin-password") {
      if (req.method === "GET") {
        const state = readStateFromDb(db);
        sendJson(res, 200, { password: state.adminPassword }, getCorsHeaders());
        return;
      }

      if (req.method === "PUT") {
        if (!checkWriteRateLimit(req, pathname, res)) return;

        const state = readStateFromDb(db);
        if (!checkWriteAuthorization(req, state.adminPassword)) {
          sendJson(res, 401, { error: "admin-auth-required" }, getCorsHeaders());
          return;
        }

        let body;
        try {
          body = await readBodyJson(req, MAX_BODY_BYTES);
        } catch {
          sendJson(res, 400, { error: "invalid-json" }, getCorsHeaders());
          return;
        }

        const passwordValidation = validatePasswordUpdate(body);
        if (!passwordValidation.ok) {
          sendJson(res, 400, { error: passwordValidation.error }, getCorsHeaders());
          return;
        }

        const { password: nextPassword, currentPassword } = passwordValidation.value;
        if (currentPassword && !constantTimeEqual(currentPassword, state.adminPassword)) {
          sendJson(res, 403, { error: "current-password-invalid" }, getCorsHeaders());
          return;
        }

        try {
          setAdminPasswordInDb(db, nextPassword);
          sendJson(res, 200, { ok: true, password: nextPassword }, getCorsHeaders());
          return;
        } catch {
          sendJson(res, 500, { error: "db-write-error" }, getCorsHeaders());
          return;
        }
      }

      sendText(res, 405, "Method Not Allowed", getCorsHeaders());
      return;
    }

    notFound(res, getCorsHeaders());
  };
}

module.exports = {
  createApiHandler
};
