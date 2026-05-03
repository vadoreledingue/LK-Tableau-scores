"use strict";

const DEFAULT_CATEGORIES = ["petit", "moyen", "grands"];
const DEFAULT_EVENT_TAGS = ["kata", "frappe", "lutte", "sol"];
const CATEGORY_CANONICAL_MAP = {
  petit: "petit",
  petits: "petit",
  puissance: "petit",
  moyen: "moyen",
  moyens: "moyen",
  technique: "moyen",
  grand: "grands",
  grands: "grands",
  discipline: "grands"
};

function cleanText(value) {
  return String(value || "").trim();
}

function unique(items) {
  return Array.from(new Set(items));
}

function normalizeCategory(value) {
  const cleaned = cleanText(value);
  if (!cleaned) return "";
  return CATEGORY_CANONICAL_MAP[cleaned.toLowerCase()] || cleaned;
}

function normalizeEventTag(value) {
  return cleanText(value);
}

function normalizeEntry(entry) {
  const raw = entry && typeof entry === "object" ? entry : {};
  return {
    id: cleanText(raw.id) || `res-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
    season: cleanText(raw.season),
    team: cleanText(raw.team),
    category: normalizeCategory(raw.category),
    tag: normalizeEventTag(raw.tag),
    score: Number.isFinite(Number(raw.score)) ? Math.max(0, Math.floor(Number(raw.score))) : 0,
    note: typeof raw.note === "string" ? raw.note : "",
    occurredAt: cleanText(raw.occurredAt || raw.occurred_at || raw.date)
  };
}

function isSupportedEntry(entry, teams) {
  return Boolean(entry && entry.season && entry.team && teams.includes(entry.team) && entry.category && entry.tag && entry.occurredAt);
}

function normalizeState(input, defaultState) {
  const state = input && typeof input === "object" ? input : {};
  const teams = Array.isArray(state.teams) ? unique(state.teams.map(cleanText).filter(Boolean)) : [];
  const fallbackTeams =
    defaultState && Array.isArray(defaultState.teams) ? unique(defaultState.teams.map(cleanText).filter(Boolean)) : [];
  const normalizedTeams = teams.length ? teams : fallbackTeams;
  const normalizedEntries = Array.isArray(state.entries)
    ? state.entries.map((entry) => normalizeEntry(entry)).filter((entry) => isSupportedEntry(entry, normalizedTeams))
    : [];
  const normalizedCategories = Array.isArray(state.categories)
    ? unique(state.categories.map((value) => normalizeCategory(value)).filter(Boolean))
    : [];
  const normalizedTags = Array.isArray(state.tags)
    ? unique(state.tags.map((value) => normalizeEventTag(value)).filter(Boolean))
    : [];

  return {
    entries: normalizedEntries,
    teams: normalizedTeams,
    categories: normalizedCategories.length ? normalizedCategories : [...DEFAULT_CATEGORIES],
    tags: normalizedTags.length ? normalizedTags : [...DEFAULT_EVENT_TAGS],
    teamStyles: state.teamStyles && typeof state.teamStyles === "object" ? state.teamStyles : {},
    adminPassword:
      typeof state.adminPassword === "string" && state.adminPassword.trim()
        ? state.adminPassword.trim()
        : defaultState.adminPassword,
    revision: Number.isInteger(state.revision) && state.revision >= 0 ? state.revision : 0,
    updatedAt: typeof state.updatedAt === "string" && state.updatedAt.trim() ? state.updatedAt : null
  };
}

module.exports = {
  cleanText,
  normalizeCategory,
  normalizeEventTag,
  normalizeEntry,
  normalizeState
};
