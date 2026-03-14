"use strict";

const crypto = require("crypto");

function applySecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
}

function createRequestId() {
  return crypto.randomBytes(8).toString("hex");
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : "unknown";
}

function logRequest({ enabled, requestId, method, pathname, statusCode, elapsedMs, clientIp }) {
  if (!enabled) return;
  const stamp = new Date().toISOString();
  console.log(
    `[${stamp}] [${requestId}] ${clientIp} ${method} ${pathname} -> ${statusCode} (${elapsedMs}ms)`
  );
}

function constantTimeEqual(left, right) {
  const a = Buffer.from(String(left || ""), "utf8");
  const b = Buffer.from(String(right || ""), "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function createWriteRateLimiter({ windowMs, maxRequests }) {
  const buckets = new Map();

  return {
    allow(key) {
      const now = Date.now();
      const current = buckets.get(key);
      if (!current || now - current.windowStart >= windowMs) {
        buckets.set(key, { windowStart: now, count: 1 });
        return { allowed: true, remaining: maxRequests - 1, retryAfterSeconds: 0 };
      }

      if (current.count >= maxRequests) {
        const retryAfterMs = Math.max(0, windowMs - (now - current.windowStart));
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: Math.ceil(retryAfterMs / 1000)
        };
      }

      current.count += 1;
      return {
        allowed: true,
        remaining: Math.max(0, maxRequests - current.count),
        retryAfterSeconds: 0
      };
    }
  };
}

module.exports = {
  applySecurityHeaders,
  createRequestId,
  getClientIp,
  logRequest,
  constantTimeEqual,
  createWriteRateLimiter
};
