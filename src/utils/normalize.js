"use strict";

function cleanText(value) {
  return String(value || "").trim();
}

function unique(items) {
  return Array.from(new Set(items));
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

function normalizeState(input, defaultState) {
  const state = input && typeof input === "object" ? input : {};
  return {
    entries: Array.isArray(state.entries) ? state.entries.map((entry) => normalizeEntry(entry)) : [],
    teams: Array.isArray(state.teams) ? unique(state.teams.map(cleanText).filter(Boolean)) : [],
    categories: Array.isArray(state.categories)
      ? unique(state.categories.map(cleanText).filter(Boolean))
      : [],
    tags: Array.isArray(state.tags) ? unique(state.tags.map(cleanText).filter(Boolean)) : [],
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
  normalizeEntry,
  normalizeState
};
