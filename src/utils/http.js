"use strict";

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    ...extraHeaders
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, message, extraHeaders = {}) {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    ...extraHeaders
  });
  res.end(message);
}

function notFound(res, extraHeaders = {}) {
  sendText(res, 404, "Not Found", extraHeaders);
}

async function readBodyJson(req, maxBytes = 2 * 1024 * 1024) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) {
      throw new Error("payload-too-large");
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(raw || "{}");
}

module.exports = {
  sendJson,
  sendText,
  notFound,
  readBodyJson
};
