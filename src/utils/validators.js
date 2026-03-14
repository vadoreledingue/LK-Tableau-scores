"use strict";

const MAX_COLLECTION_ITEMS = 1000;
const MAX_SHORT_TEXT = 80;
const MAX_MEDIUM_TEXT = 120;
const MAX_NOTE_TEXT = 500;
const MAX_LOGO_DATA_URL = 1_500_000;

function isStringArray(value, maxLength) {
  if (!Array.isArray(value)) return false;
  if (value.length > MAX_COLLECTION_ITEMS) return false;
  return value.every((item) => typeof item === "string" && item.trim().length > 0 && item.trim().length <= maxLength);
}

function validateEntry(entry) {
  if (!entry || typeof entry !== "object") return "entry-invalid";

  const team = String(entry.team || "").trim();
  const category = String(entry.category || "").trim();
  const season = String(entry.season || "").trim();
  const tag = String(entry.tag || "").trim();
  const occurredAt = String(entry.occurredAt || entry.occurred_at || "").trim();
  const note = typeof entry.note === "string" ? entry.note : "";
  const score = Number(entry.score);

  if (!team || team.length > MAX_MEDIUM_TEXT) return "entry-team-invalid";
  if (!category || category.length > MAX_MEDIUM_TEXT) return "entry-category-invalid";
  if (!season || season.length > MAX_SHORT_TEXT) return "entry-season-invalid";
  if (!tag || tag.length > MAX_MEDIUM_TEXT) return "entry-tag-invalid";
  if (!occurredAt || occurredAt.length > 64) return "entry-occurredAt-invalid";
  if (note.length > MAX_NOTE_TEXT) return "entry-note-too-long";
  if (!Number.isFinite(score) || score < 0 || score > 100000) return "entry-score-invalid";

  return null;
}

function validateTeamStyles(value, teams) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "teamStyles-invalid";

  const allowedTeamNames = new Set(Array.isArray(teams) ? teams : []);
  const entries = Object.entries(value);
  if (entries.length > MAX_COLLECTION_ITEMS) return "teamStyles-too-many";

  for (const [teamName, style] of entries) {
    if (typeof teamName !== "string" || !teamName.trim() || teamName.length > MAX_MEDIUM_TEXT) {
      return "teamStyles-team-invalid";
    }
    if (allowedTeamNames.size && !allowedTeamNames.has(teamName)) {
      return "teamStyles-team-unknown";
    }
    if (!style || typeof style !== "object" || Array.isArray(style)) {
      return "teamStyles-style-invalid";
    }

    const color = String(style.color || "").trim();
    const logo = String(style.logo || "").trim();
    if (color.length > 32) return "teamStyles-color-invalid";
    if (logo.length > MAX_LOGO_DATA_URL) return "teamStyles-logo-too-large";
  }

  return null;
}

function validateResultsPatch(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "body-invalid" };
  }

  if (Object.prototype.hasOwnProperty.call(body, "entries")) {
    if (!Array.isArray(body.entries) || body.entries.length > MAX_COLLECTION_ITEMS) {
      return { ok: false, error: "entries-invalid" };
    }
    for (const entry of body.entries) {
      const err = validateEntry(entry);
      if (err) return { ok: false, error: err };
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "teams") && !isStringArray(body.teams, MAX_MEDIUM_TEXT)) {
    return { ok: false, error: "teams-invalid" };
  }

  if (
    Object.prototype.hasOwnProperty.call(body, "categories") &&
    !isStringArray(body.categories, MAX_MEDIUM_TEXT)
  ) {
    return { ok: false, error: "categories-invalid" };
  }

  if (Object.prototype.hasOwnProperty.call(body, "tags") && !isStringArray(body.tags, MAX_MEDIUM_TEXT)) {
    return { ok: false, error: "tags-invalid" };
  }

  if (Object.prototype.hasOwnProperty.call(body, "teamStyles")) {
    const futureTeams = Array.isArray(body.teams) ? body.teams : [];
    const err = validateTeamStyles(body.teamStyles, futureTeams);
    if (err) return { ok: false, error: err };
  }

  if (Object.prototype.hasOwnProperty.call(body, "revision")) {
    const revision = Number(body.revision);
    if (!Number.isInteger(revision) || revision < 0) {
      return { ok: false, error: "revision-invalid" };
    }
  }

  return { ok: true };
}

function validatePasswordUpdate(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "body-invalid" };
  }

  const nextPassword = typeof body.password === "string" ? body.password.trim() : "";
  if (!nextPassword) return { ok: false, error: "password-required" };
  if (nextPassword.length < 8) return { ok: false, error: "password-too-short" };
  if (nextPassword.length > 256) return { ok: false, error: "password-too-long" };

  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword.trim() : "";

  return {
    ok: true,
    value: {
      password: nextPassword,
      currentPassword
    }
  };
}

module.exports = {
  validateResultsPatch,
  validatePasswordUpdate
};
