const TEAMS = ["Aigles", "Lions", "Pantheres", "Tigres", "Dragons"];
const CATEGORIES = ["Cat. 1", "Cat. 2", "Cat. 3"];
const STORAGE_KEY = "royal-scoreboard-v2";
const LEGACY_STORAGE_KEY = "royal-scoreboard-v1";
const CURRENT_SEASON = getSeasonFromDate(new Date().toISOString().slice(0, 10));

const seedData = [
  { season: CURRENT_SEASON, team: "Aigles", category: "Cat. 1", score: 22, note: "Match ouverture", date: "2026-03-01" },
  { season: CURRENT_SEASON, team: "Lions", category: "Cat. 2", score: 17, note: "Tour 1", date: "2026-03-02" },
  { season: CURRENT_SEASON, team: "Pantheres", category: "Cat. 3", score: 19, note: "Tour 1", date: "2026-03-02" },
  { season: CURRENT_SEASON, team: "Tigres", category: "Cat. 1", score: 14, note: "Tour 1", date: "2026-03-03" },
  { season: CURRENT_SEASON, team: "Dragons", category: "Cat. 2", score: 27, note: "Tour 1", date: "2026-03-03" }
];

const form = document.getElementById("score-form");
const seasonInput = document.getElementById("season");
const seasonsList = document.getElementById("seasons-list");
const teamSelect = document.getElementById("team");
const categorySelect = document.getElementById("category");
const scoreInput = document.getElementById("score");
const noteInput = document.getElementById("opponent");
const dateInput = document.getElementById("date");
const activeSeasonSelect = document.getElementById("active-season");
const rankingBody = document.getElementById("ranking-body");
const historyBody = document.getElementById("history-body");
const filterSeason = document.getElementById("filter-season");
const filterTeam = document.getElementById("filter-team");
const filterCategory = document.getElementById("filter-category");
const resetButton = document.getElementById("reset-data");

let entries = loadEntries();

buildSelect(teamSelect, TEAMS);
buildSelect(categorySelect, CATEGORIES);
buildStaticFilters();
refreshSeasonControls(CURRENT_SEASON);

if (!dateInput.value) {
  dateInput.valueAsDate = new Date();
}
if (!seasonInput.value) {
  seasonInput.value = CURRENT_SEASON;
}

renderAll();

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const season = normalizeSeason(seasonInput.value);
  const team = teamSelect.value;
  const category = categorySelect.value;
  const score = Number(scoreInput.value);
  const note = noteInput.value.trim();
  const date = dateInput.value;

  if (!season || !team || !category || Number.isNaN(score) || score < 0 || !date) {
    return;
  }

  entries.unshift({ season, team, category, score, note, date });
  saveEntries();
  form.reset();
  dateInput.valueAsDate = new Date();
  seasonInput.value = season;
  refreshSeasonControls(season);
  renderAll();
});

activeSeasonSelect.addEventListener("change", () => {
  if (filterSeason.querySelector(`option[value="${activeSeasonSelect.value}"]`)) {
    filterSeason.value = activeSeasonSelect.value;
  }
  renderAll();
});

filterSeason.addEventListener("change", renderHistory);
filterTeam.addEventListener("change", renderHistory);
filterCategory.addEventListener("change", renderHistory);

resetButton.addEventListener("click", () => {
  const confirmed = window.confirm("Supprimer tous les resultats enregistres ?");
  if (!confirmed) return;

  entries = [...seedData];
  saveEntries();
  seasonInput.value = CURRENT_SEASON;
  refreshSeasonControls(CURRENT_SEASON);
  renderAll();
});

function buildSelect(selectEl, values) {
  selectEl.innerHTML = "";
  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    selectEl.appendChild(option);
  }
}

function buildStaticFilters() {
  filterTeam.innerHTML = "";
  filterCategory.innerHTML = "";

  addOption(filterTeam, "all", "Toutes");
  addOption(filterCategory, "all", "Toutes");

  TEAMS.forEach((team) => addOption(filterTeam, team, team));
  CATEGORIES.forEach((category) => addOption(filterCategory, category, category));
}

function refreshSeasonControls(preferredSeason) {
  const previousActive = activeSeasonSelect.value;
  const previousFilter = filterSeason.value;
  const seasons = getSeasonList(entries);

  seasonsList.innerHTML = "";
  seasons.forEach((season) => {
    const option = document.createElement("option");
    option.value = season;
    seasonsList.appendChild(option);
  });

  fillSeasonSelect(activeSeasonSelect, seasons, "all", "Toutes les saisons");
  fillSeasonSelect(filterSeason, seasons, "all", "Toutes");

  activeSeasonSelect.value = resolveSeasonValue(activeSeasonSelect, preferredSeason, previousActive);
  filterSeason.value = resolveSeasonValue(filterSeason, preferredSeason, previousFilter);
}

function fillSeasonSelect(selectEl, seasons, allValue, allLabel) {
  selectEl.innerHTML = "";
  addOption(selectEl, allValue, allLabel);
  seasons.forEach((season) => addOption(selectEl, season, season));
}

function resolveSeasonValue(selectEl, preferred, previous) {
  const values = Array.from(selectEl.options, (option) => option.value);
  if (preferred && values.includes(preferred)) return preferred;
  if (previous && values.includes(previous)) return previous;
  if (values.includes(CURRENT_SEASON)) return CURRENT_SEASON;
  return values[0] || "all";
}

function addOption(selectEl, value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  selectEl.appendChild(option);
}

function renderAll() {
  renderRanking();
  renderHistory();
}

function renderRanking() {
  const seasonFilter = activeSeasonSelect.value;
  const rankingEntries = entries.filter((entry) => seasonFilter === "all" || entry.season === seasonFilter);

  const stats = TEAMS.map((team) => {
    const records = rankingEntries.filter((entry) => entry.team === team);
    const categoryScores = CATEGORIES.map((category) =>
      records.filter((entry) => entry.category === category).reduce((sum, entry) => sum + entry.score, 0)
    );

    const total = categoryScores.reduce((sum, value) => sum + value, 0);
    const count = records.length;
    const average = count ? (total / count).toFixed(1) : "0.0";

    return { team, categoryScores, total, average, count };
  }).sort((a, b) => b.total - a.total);

  rankingBody.innerHTML = "";

  stats.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${row.team}</strong></td>
      <td>${row.categoryScores[0]}</td>
      <td>${row.categoryScores[1]}</td>
      <td>${row.categoryScores[2]}</td>
      <td><strong>${row.total}</strong></td>
      <td>${row.average}</td>
      <td>${row.count}</td>
    `;
    rankingBody.appendChild(tr);
  });
}

function renderHistory() {
  const seasonFilter = filterSeason.value;
  const teamFilter = filterTeam.value;
  const categoryFilter = filterCategory.value;

  const rows = entries
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
      <td>${entry.season}</td>
      <td>${formatDate(entry.date)}</td>
      <td>${entry.team}</td>
      <td>${entry.category}</td>
      <td>${entry.score}</td>
      <td>${entry.note || "-"}</td>
    `;
    historyBody.appendChild(tr);
  });
}

function loadEntries() {
  const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return [...seedData];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...seedData];

    return parsed.map((entry) => ({
      season: normalizeSeason(entry.season) || getSeasonFromDate(entry.date) || CURRENT_SEASON,
      team: entry.team,
      category: entry.category,
      score: Number(entry.score) || 0,
      note: typeof entry.note === "string" ? entry.note : "",
      date: entry.date
    }));
  } catch {
    return [...seedData];
  }
}

function saveEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  localStorage.removeItem(LEGACY_STORAGE_KEY);
}

function getSeasonList(data) {
  const set = new Set(data.map((entry) => normalizeSeason(entry.season)).filter(Boolean));
  set.add(CURRENT_SEASON);
  return Array.from(set).sort(compareSeasonsDesc);
}

function compareSeasonsDesc(a, b) {
  const startA = Number((a || "").split("-")[0]);
  const startB = Number((b || "").split("-")[0]);
  if (Number.isNaN(startA) || Number.isNaN(startB)) return String(b).localeCompare(String(a));
  return startB - startA;
}

function normalizeSeason(value) {
  if (!value) return "";
  const cleaned = String(value).trim().replace(/\s+/g, "");
  const match = cleaned.match(/^(\d{4})-(\d{4})$/);
  if (!match) return "";

  const start = Number(match[1]);
  const end = Number(match[2]);
  if (end !== start + 1) return "";

  return `${start}-${end}`;
}

function getSeasonFromDate(value) {
  if (!value || !value.includes("-")) return CURRENT_SEASON;
  const [yearText, monthText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (Number.isNaN(year) || Number.isNaN(month)) return CURRENT_SEASON;

  const start = month >= 7 ? year : year - 1;
  return `${start}-${start + 1}`;
}

function formatDate(value) {
  if (!value) return "-";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}
