const APP_STORAGE_KEY = "kinshima-scoreboard-v4";
const LEGACY_KEYS = ["kinshima-scoreboard-v3", "royal-scoreboard-v2", "royal-scoreboard-v1"];
const ADMIN_SESSION_KEY = "kinshima-admin-session";
const ADMIN_SECURITY_KEY = "kinshima-admin-security";
const ADMIN_FALLBACK_PASSWORD = "Kinshima-Admin-2026";
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000;

const defaultState = {
  teams: ["KJ", "KL", "KTM", "KCM", "KM"],
  categories: ["Puissance", "Technique", "Discipline"],
  entries: [
    { season: "LK26", team: "KJ", category: "Puissance", score: 22, note: "Combat d'ouverture", date: "2026-03-01" },
    { season: "LK26", team: "KL", category: "Technique", score: 17, note: "Tour 1", date: "2026-03-02" },
    { season: "LK26", team: "KTM", category: "Discipline", score: 19, note: "Tour 1", date: "2026-03-02" },
    { season: "LK26", team: "KCM", category: "Puissance", score: 14, note: "Tour 1", date: "2026-03-03" },
    { season: "LK26", team: "KM", category: "Technique", score: 27, note: "Tour 1", date: "2026-03-03" }
  ]
};

const state = loadAppState();
let security = loadSecurityState();

const rankingHead = document.getElementById("ranking-head");
const rankingBody = document.getElementById("ranking-body");
const historyBody = document.getElementById("history-body");

const activeSeasonSelect = document.getElementById("active-season");
const filterSeason = document.getElementById("filter-season");
const filterTeam = document.getElementById("filter-team");
const filterCategory = document.getElementById("filter-category");

const adminLocked = document.getElementById("admin-locked");
const adminUnlocked = document.getElementById("admin-unlocked");
const adminLogout = document.getElementById("admin-logout");
const adminLoginForm = document.getElementById("admin-login-form");
const adminPasswordInput = document.getElementById("admin-password");
const adminLockInfo = document.getElementById("admin-lock-info");
const adminLoginError = document.getElementById("admin-login-error");
const adminFeedback = document.getElementById("admin-feedback");

const scoreForm = document.getElementById("score-form");
const seasonInput = document.getElementById("season");
const seasonsList = document.getElementById("seasons-list");
const teamSelect = document.getElementById("team");
const categorySelect = document.getElementById("category");
const scoreInput = document.getElementById("score");
const noteInput = document.getElementById("note");
const dateInput = document.getElementById("date");
const resetButton = document.getElementById("reset-data");

const teamRenameForm = document.getElementById("team-rename-form");
const teamRenameSelect = document.getElementById("team-rename-select");
const teamRenameInput = document.getElementById("team-rename-input");
const teamAddForm = document.getElementById("team-add-form");
const teamAddInput = document.getElementById("team-add-input");
const teamDeleteForm = document.getElementById("team-delete-form");
const teamDeleteSelect = document.getElementById("team-delete-select");

const categoryRenameForm = document.getElementById("category-rename-form");
const categoryRenameSelect = document.getElementById("category-rename-select");
const categoryRenameInput = document.getElementById("category-rename-input");
const categoryAddForm = document.getElementById("category-add-form");
const categoryAddInput = document.getElementById("category-add-input");
const categoryDeleteForm = document.getElementById("category-delete-form");
const categoryDeleteSelect = document.getElementById("category-delete-select");

const passwordChangeForm = document.getElementById("admin-password-change-form");
const currentPasswordInput = document.getElementById("admin-current-password");
const newPasswordInput = document.getElementById("admin-new-password");
const confirmPasswordInput = document.getElementById("admin-confirm-password");

const hasPublicView = Boolean(rankingHead && rankingBody && historyBody);
const hasAdminView = Boolean(adminLocked && adminUnlocked && adminLoginForm);

let lockTimerId = null;

initialize();

function initialize() {
  hydrateEntries();
  if (dateInput && !dateInput.value) {
    dateInput.valueAsDate = new Date();
  }

  refreshAllControls(getCurrentSeasonCode());
  if (hasPublicView) renderAll();
  if (hasAdminView) syncAdminUI();
  wireEvents();
}

function wireEvents() {
  if (activeSeasonSelect) activeSeasonSelect.addEventListener("change", renderAll);
  if (filterSeason) filterSeason.addEventListener("change", renderHistory);
  if (filterTeam) filterTeam.addEventListener("change", renderHistory);
  if (filterCategory) filterCategory.addEventListener("change", renderHistory);

  if (adminLoginForm) adminLoginForm.addEventListener("submit", handleAdminLogin);
  if (adminLogout) adminLogout.addEventListener("click", handleAdminLogout);

  if (scoreForm) scoreForm.addEventListener("submit", handleScoreSubmit);
  if (resetButton) resetButton.addEventListener("click", handleResetScores);

  if (teamAddForm) teamAddForm.addEventListener("submit", handleTeamAdd);
  if (teamRenameForm) teamRenameForm.addEventListener("submit", handleTeamRename);
  if (teamDeleteForm) teamDeleteForm.addEventListener("submit", handleTeamDelete);

  if (categoryAddForm) categoryAddForm.addEventListener("submit", handleCategoryAdd);
  if (categoryRenameForm) categoryRenameForm.addEventListener("submit", handleCategoryRename);
  if (categoryDeleteForm) categoryDeleteForm.addEventListener("submit", handleCategoryDelete);

  if (passwordChangeForm) passwordChangeForm.addEventListener("submit", handlePasswordChange);
}

function handleAdminLogin(event) {
  event.preventDefault();

  if (isLockedOut()) {
    showLoginError(lockoutMessage());
    return;
  }

  const submitted = adminPasswordInput.value;
  if (submitted === security.password) {
    security.failCount = 0;
    security.lockedUntil = 0;
    saveSecurityState();

    localStorage.setItem(ADMIN_SESSION_KEY, "1");
    adminPasswordInput.value = "";
    adminLoginError.classList.add("hidden");
    syncAdminUI();
    return;
  }

  security.failCount += 1;
  if (security.failCount >= MAX_LOGIN_ATTEMPTS) {
    security.lockedUntil = Date.now() + LOCKOUT_MS;
    security.failCount = 0;
    showLoginError(lockoutMessage());
  } else {
    const remaining = MAX_LOGIN_ATTEMPTS - security.failCount;
    showLoginError(`Mot de passe invalide. Tentatives restantes: ${remaining}.`);
  }

  saveSecurityState();
}

function handleAdminLogout() {
  localStorage.removeItem(ADMIN_SESSION_KEY);
  syncAdminUI();
}

function handleScoreSubmit(event) {
  event.preventDefault();
  if (!isAdmin()) return;

  const season = normalizeSeasonCode(seasonInput.value);
  const team = teamSelect.value;
  const category = categorySelect.value;
  const score = Number(scoreInput.value);
  const note = noteInput.value.trim();
  const date = dateInput.value;

  if (!season) {
    showAdminFeedback("Format saison invalide. Utilise LK26, LK27, etc.", "error");
    return;
  }

  if (!team || !category || Number.isNaN(score) || score < 0 || !date) {
    showAdminFeedback("Tous les champs de score sont obligatoires.", "error");
    return;
  }

  state.entries.unshift({ season, team, category, score, note, date });
  saveState();

  scoreForm.reset();
  dateInput.valueAsDate = new Date();
  seasonInput.value = season;

  refreshAllControls(season);
  renderAll();
  showAdminFeedback("Score ajoute.", "success");
}

function handleResetScores() {
  if (!isAdmin()) return;
  const confirmed = window.confirm("Supprimer tous les resultats ?");
  if (!confirmed) return;

  state.entries = [...defaultState.entries];
  saveState();
  refreshAllControls(getCurrentSeasonCode());
  renderAll();
  showAdminFeedback("Scores reinitialises.", "success");
}

function handleTeamAdd(event) {
  event.preventDefault();
  if (!isAdmin()) return;

  const newName = sanitizeName(teamAddInput.value);
  if (!newName) {
    showAdminFeedback("Nom de clan invalide.", "error");
    return;
  }
  if (hasName(state.teams, newName)) {
    showAdminFeedback("Ce clan existe deja.", "error");
    return;
  }

  state.teams.push(newName);
  teamAddInput.value = "";
  saveState();
  refreshAllControls(activeSeasonSelect ? activeSeasonSelect.value : getCurrentSeasonCode());
  renderAll();
  showAdminFeedback("Clan ajoute.", "success");
}

function handleTeamRename(event) {
  event.preventDefault();
  if (!isAdmin()) return;

  const oldName = teamRenameSelect.value;
  const newName = sanitizeName(teamRenameInput.value);

  if (!oldName || !newName || normalizeText(oldName) === normalizeText(newName)) {
    showAdminFeedback("Renommage invalide.", "error");
    return;
  }
  if (hasName(state.teams, newName)) {
    showAdminFeedback("Un clan avec ce nom existe deja.", "error");
    return;
  }

  state.teams = state.teams.map((team) => (team === oldName ? newName : team));
  state.entries = state.entries.map((entry) => ({
    ...entry,
    team: entry.team === oldName ? newName : entry.team
  }));

  teamRenameInput.value = "";
  saveState();
  refreshAllControls(activeSeasonSelect ? activeSeasonSelect.value : getCurrentSeasonCode());
  renderAll();
  showAdminFeedback("Clan renomme.", "success");
}

function handleTeamDelete(event) {
  event.preventDefault();
  if (!isAdmin()) return;

  const target = teamDeleteSelect.value;
  if (!target) {
    showAdminFeedback("Selectionne un clan a supprimer.", "error");
    return;
  }
  if (state.teams.length <= 1) {
    showAdminFeedback("Impossible: il faut garder au moins un clan.", "error");
    return;
  }
  if (state.entries.some((entry) => entry.team === target)) {
    showAdminFeedback("Impossible de supprimer ce clan: des scores lui sont associes.", "error");
    return;
  }

  state.teams = state.teams.filter((team) => team !== target);
  saveState();
  refreshAllControls(activeSeasonSelect ? activeSeasonSelect.value : getCurrentSeasonCode());
  renderAll();
  showAdminFeedback("Clan supprime.", "success");
}

function handleCategoryAdd(event) {
  event.preventDefault();
  if (!isAdmin()) return;

  const newName = sanitizeName(categoryAddInput.value);
  if (!newName) {
    showAdminFeedback("Nom de categorie invalide.", "error");
    return;
  }
  if (hasName(state.categories, newName)) {
    showAdminFeedback("Cette categorie existe deja.", "error");
    return;
  }

  state.categories.push(newName);
  categoryAddInput.value = "";
  saveState();
  refreshAllControls(activeSeasonSelect ? activeSeasonSelect.value : getCurrentSeasonCode());
  renderAll();
  showAdminFeedback("Categorie ajoutee.", "success");
}

function handleCategoryRename(event) {
  event.preventDefault();
  if (!isAdmin()) return;

  const oldName = categoryRenameSelect.value;
  const newName = sanitizeName(categoryRenameInput.value);

  if (!oldName || !newName || normalizeText(oldName) === normalizeText(newName)) {
    showAdminFeedback("Renommage invalide.", "error");
    return;
  }
  if (hasName(state.categories, newName)) {
    showAdminFeedback("Une categorie avec ce nom existe deja.", "error");
    return;
  }

  state.categories = state.categories.map((category) => (category === oldName ? newName : category));
  state.entries = state.entries.map((entry) => ({
    ...entry,
    category: entry.category === oldName ? newName : entry.category
  }));

  categoryRenameInput.value = "";
  saveState();
  refreshAllControls(activeSeasonSelect ? activeSeasonSelect.value : getCurrentSeasonCode());
  renderAll();
  showAdminFeedback("Categorie renommee.", "success");
}

function handleCategoryDelete(event) {
  event.preventDefault();
  if (!isAdmin()) return;

  const target = categoryDeleteSelect.value;
  if (!target) {
    showAdminFeedback("Selectionne une categorie a supprimer.", "error");
    return;
  }
  if (state.categories.length <= 1) {
    showAdminFeedback("Impossible: il faut garder au moins une categorie.", "error");
    return;
  }
  if (state.entries.some((entry) => entry.category === target)) {
    showAdminFeedback("Impossible de supprimer cette categorie: des scores y sont associes.", "error");
    return;
  }

  state.categories = state.categories.filter((category) => category !== target);
  saveState();
  refreshAllControls(activeSeasonSelect ? activeSeasonSelect.value : getCurrentSeasonCode());
  renderAll();
  showAdminFeedback("Categorie supprimee.", "success");
}

function handlePasswordChange(event) {
  event.preventDefault();
  if (!isAdmin()) return;

  const currentPassword = currentPasswordInput.value;
  const newPassword = newPasswordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  if (currentPassword !== security.password) {
    showAdminFeedback("Mot de passe actuel incorrect.", "error");
    return;
  }
  if (newPassword.length < 8) {
    showAdminFeedback("Le nouveau mot de passe doit contenir au moins 8 caracteres.", "error");
    return;
  }
  if (newPassword !== confirmPassword) {
    showAdminFeedback("La confirmation du nouveau mot de passe ne correspond pas.", "error");
    return;
  }

  security.password = newPassword;
  security.failCount = 0;
  security.lockedUntil = 0;
  saveSecurityState();

  passwordChangeForm.reset();
  showAdminFeedback("Mot de passe admin mis a jour.", "success");
}

function syncAdminUI() {
  if (!hasAdminView) return;
  const unlocked = isAdmin();

  adminLocked.classList.toggle("hidden", unlocked);
  adminUnlocked.classList.toggle("hidden", !unlocked);
  adminLogout.classList.toggle("hidden", !unlocked);

  if (unlocked) {
    adminLoginError.classList.add("hidden");
    adminLockInfo.textContent = "Session admin active.";
  } else {
    adminPasswordInput.value = "";
    if (isLockedOut()) {
      showLoginError(lockoutMessage());
    } else {
      adminLoginError.classList.add("hidden");
      const remaining = Math.max(0, MAX_LOGIN_ATTEMPTS - security.failCount);
      adminLockInfo.textContent = `5 erreurs consecutives bloquent l'acces 5 minutes. Tentatives restantes: ${remaining}.`;
    }
  }

  setupLockoutTicker();
}

function setupLockoutTicker() {
  if (lockTimerId) {
    clearInterval(lockTimerId);
    lockTimerId = null;
  }

  if (!isLockedOut()) {
    return;
  }

  lockTimerId = setInterval(() => {
    if (!isLockedOut()) {
      clearInterval(lockTimerId);
      lockTimerId = null;
      adminLoginError.classList.add("hidden");
      adminLockInfo.textContent = "Le verrouillage est termine. Tu peux reessayer.";
      return;
    }

    showLoginError(lockoutMessage());
  }, 1000);
}

function showLoginError(message) {
  if (!adminLoginError || !adminLockInfo) return;
  adminLoginError.textContent = message;
  adminLoginError.classList.remove("hidden");
  adminLockInfo.textContent = message;
}

function lockoutMessage() {
  const secondsLeft = Math.ceil((security.lockedUntil - Date.now()) / 1000);
  const safeSeconds = Math.max(1, secondsLeft);
  return `Acces temporairement bloque. Reessaie dans ${safeSeconds}s.`;
}

function isLockedOut() {
  return Number(security.lockedUntil || 0) > Date.now();
}

function isAdmin() {
  return localStorage.getItem(ADMIN_SESSION_KEY) === "1";
}

function refreshAllControls(preferredSeason) {
  refreshSeasonControls(preferredSeason);
  refreshTeamControls();
  refreshCategoryControls();
}

function refreshSeasonControls(preferredSeason) {
  const seasons = getSeasonList(state.entries);
  const previousActive = activeSeasonSelect ? activeSeasonSelect.value : "";
  const previousFilter = filterSeason ? filterSeason.value : "";

  if (seasonsList) {
    seasonsList.innerHTML = "";
    seasons.forEach((season) => {
      const option = document.createElement("option");
      option.value = season;
      seasonsList.appendChild(option);
    });
  }

  if (activeSeasonSelect) {
    fillSelect(activeSeasonSelect, seasons, { includeAll: true, allLabel: "Toutes" });
    activeSeasonSelect.value = chooseSelectValue(activeSeasonSelect, [preferredSeason, previousActive, getCurrentSeasonCode(), "all"]);
  }
  if (filterSeason) {
    fillSelect(filterSeason, seasons, { includeAll: true, allLabel: "Toutes" });
    filterSeason.value = chooseSelectValue(filterSeason, [preferredSeason, previousFilter, "all"]);
  }

  if (seasonInput && !seasonInput.value) {
    seasonInput.value = getCurrentSeasonCode();
  }
}

function refreshTeamControls() {
  fillSelect(teamSelect, state.teams);
  fillSelect(teamRenameSelect, state.teams);
  fillSelect(teamDeleteSelect, state.teams);
  fillSelect(filterTeam, state.teams, { includeAll: true, allLabel: "Tous" });
}

function refreshCategoryControls() {
  fillSelect(categorySelect, state.categories);
  fillSelect(categoryRenameSelect, state.categories);
  fillSelect(categoryDeleteSelect, state.categories);
  fillSelect(filterCategory, state.categories, { includeAll: true, allLabel: "Toutes" });
}

function fillSelect(selectElement, values, options = {}) {
  if (!selectElement) return;
  const { includeAll = false, allLabel = "Toutes" } = options;
  const previousValue = selectElement.value;

  selectElement.innerHTML = "";
  if (includeAll) {
    addOption(selectElement, "all", allLabel);
  }

  values.forEach((value) => addOption(selectElement, value, value));
  selectElement.value = chooseSelectValue(selectElement, [previousValue, includeAll ? "all" : values[0]]);
}

function addOption(selectElement, value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  selectElement.appendChild(option);
}

function chooseSelectValue(selectElement, candidates) {
  const values = new Set(Array.from(selectElement.options, (option) => option.value));
  for (const candidate of candidates) {
    if (candidate && values.has(candidate)) {
      return candidate;
    }
  }
  return selectElement.options[0]?.value || "";
}

function renderAll() {
  if (!hasPublicView) return;
  renderRanking();
  renderHistory();
}

function renderRanking() {
  if (!rankingHead || !rankingBody) return;
  const seasonFilter = activeSeasonSelect ? activeSeasonSelect.value : "all";
  const scopedEntries = state.entries.filter((entry) => seasonFilter === "all" || entry.season === seasonFilter);

  rankingHead.innerHTML = "";
  const headerRow = document.createElement("tr");
  headerRow.innerHTML = `<th>Clan</th>${state.categories.map((category) => `<th>${escapeHtml(category)}</th>`).join("")}<th>Total</th><th>Moyenne</th><th>Entrees</th>`;
  rankingHead.appendChild(headerRow);

  const stats = state.teams.map((team) => {
    const teamEntries = scopedEntries.filter((entry) => entry.team === team);
    const categoryScores = state.categories.map((category) => {
      return teamEntries
        .filter((entry) => entry.category === category)
        .reduce((sum, entry) => sum + entry.score, 0);
    });

    const total = categoryScores.reduce((sum, value) => sum + value, 0);
    const count = teamEntries.length;
    const average = count ? (total / count).toFixed(1) : "0.0";

    return { team, categoryScores, total, average, count };
  }).sort((a, b) => b.total - a.total);

  rankingBody.innerHTML = "";
  stats.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${escapeHtml(row.team)}</strong></td>
      ${row.categoryScores.map((score) => `<td>${score}</td>`).join("")}
      <td><strong>${row.total}</strong></td>
      <td>${row.average}</td>
      <td>${row.count}</td>
    `;
    rankingBody.appendChild(tr);
  });
}

function renderHistory() {
  if (!historyBody) return;
  const seasonFilter = filterSeason ? filterSeason.value : "all";
  const teamFilter = filterTeam ? filterTeam.value : "all";
  const categoryFilter = filterCategory ? filterCategory.value : "all";

  const rows = state.entries
    .filter((entry) => seasonFilter === "all" || entry.season === seasonFilter)
    .filter((entry) => teamFilter === "all" || entry.team === teamFilter)
    .filter((entry) => categoryFilter === "all" || entry.category === categoryFilter)
    .sort((a, b) => b.date.localeCompare(a.date));

  historyBody.innerHTML = "";
  if (!rows.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="6" class="empty">Aucun resultat pour ce filtre.</td>`;
    historyBody.appendChild(tr);
    return;
  }

  rows.forEach((entry) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(entry.season)}</td>
      <td>${formatDate(entry.date)}</td>
      <td>${escapeHtml(entry.team)}</td>
      <td>${escapeHtml(entry.category)}</td>
      <td>${entry.score}</td>
      <td>${escapeHtml(entry.note || "-")}</td>
    `;
    historyBody.appendChild(tr);
  });
}

function hydrateEntries() {
  state.entries = state.entries.map((entry) => ({
    season: normalizeSeasonCode(entry.season) || getSeasonCodeFromDate(entry.date) || getCurrentSeasonCode(),
    team: String(entry.team || ""),
    category: String(entry.category || ""),
    score: Number(entry.score) || 0,
    note: typeof entry.note === "string" ? entry.note : "",
    date: typeof entry.date === "string" ? entry.date : new Date().toISOString().slice(0, 10)
  }));
}

function loadAppState() {
  const rawCurrent = localStorage.getItem(APP_STORAGE_KEY);
  if (rawCurrent) {
    try {
      return normalizeState(JSON.parse(rawCurrent));
    } catch {
      return structuredClone(defaultState);
    }
  }

  for (const key of LEGACY_KEYS) {
    const legacyRaw = localStorage.getItem(key);
    if (!legacyRaw) continue;

    try {
      const parsed = JSON.parse(legacyRaw);
      if (Array.isArray(parsed)) {
        return {
          teams: [...defaultState.teams],
          categories: [...defaultState.categories],
          entries: parsed
        };
      }
      return normalizeState(parsed);
    } catch {
      continue;
    }
  }

  return structuredClone(defaultState);
}

function normalizeState(input) {
  const teams = Array.isArray(input?.teams) ? input.teams.map(sanitizeName).filter(Boolean) : [...defaultState.teams];
  const categories = Array.isArray(input?.categories) ? input.categories.map(sanitizeName).filter(Boolean) : [...defaultState.categories];
  const entries = Array.isArray(input?.entries) ? input.entries : [...defaultState.entries];

  return {
    teams: unique(teams.length ? teams : defaultState.teams),
    categories: unique(categories.length ? categories : defaultState.categories),
    entries
  };
}

function saveState() {
  const payload = {
    teams: unique(state.teams.map(sanitizeName).filter(Boolean)),
    categories: unique(state.categories.map(sanitizeName).filter(Boolean)),
    entries: state.entries
  };

  state.teams = payload.teams;
  state.categories = payload.categories;

  localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(payload));
  LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
}

function loadSecurityState() {
  const raw = localStorage.getItem(ADMIN_SECURITY_KEY);
  if (!raw) {
    return {
      password: ADMIN_FALLBACK_PASSWORD,
      failCount: 0,
      lockedUntil: 0
    };
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      password: typeof parsed.password === "string" && parsed.password ? parsed.password : ADMIN_FALLBACK_PASSWORD,
      failCount: Number(parsed.failCount) || 0,
      lockedUntil: Number(parsed.lockedUntil) || 0
    };
  } catch {
    return {
      password: ADMIN_FALLBACK_PASSWORD,
      failCount: 0,
      lockedUntil: 0
    };
  }
}

function saveSecurityState() {
  localStorage.setItem(ADMIN_SECURITY_KEY, JSON.stringify(security));
}

function showAdminFeedback(message, type) {
  if (!adminFeedback) return;
  adminFeedback.textContent = message;
  adminFeedback.classList.remove("hidden", "success", "error");
  adminFeedback.classList.add(type === "error" ? "error" : "success");
}

function hasName(list, value) {
  const key = normalizeText(value);
  return list.some((item) => normalizeText(item) === key);
}

function normalizeText(value) {
  return sanitizeName(value).toLowerCase();
}

function getSeasonList(entries) {
  const set = new Set(entries.map((entry) => normalizeSeasonCode(entry.season)).filter(Boolean));
  set.add(getCurrentSeasonCode());

  return Array.from(set).sort((a, b) => seasonToYear(b) - seasonToYear(a));
}

function normalizeSeasonCode(value) {
  if (!value) return "";
  const cleaned = String(value).trim().toUpperCase();
  if (!/^LK\d{2}$/.test(cleaned)) return "";
  return cleaned;
}

function getCurrentSeasonCode() {
  const year = new Date().getFullYear();
  return `LK${String(year).slice(-2)}`;
}

function getSeasonCodeFromDate(dateText) {
  if (!dateText || !dateText.includes("-")) return "";
  const year = Number(dateText.slice(0, 4));
  if (Number.isNaN(year)) return "";
  return `LK${String(year).slice(-2)}`;
}

function seasonToYear(seasonCode) {
  const year2 = Number(String(seasonCode).replace("LK", ""));
  if (Number.isNaN(year2)) return 0;
  return 2000 + year2;
}

function formatDate(value) {
  if (!value || !value.includes("-")) return "-";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function sanitizeName(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function unique(items) {
  return Array.from(new Set(items));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
