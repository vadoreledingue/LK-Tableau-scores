(function () {
  const pageRoot = document.querySelector(".fast-point-add-page");
  if (!pageRoot) return;

  const seasonLabel = document.getElementById("fast-season-label");
  const currentSelection = document.getElementById("fast-current-selection");
  const clanButtons = document.getElementById("fast-clan-buttons");
  const lastEntry = document.getElementById("fast-last-entry");

  const seasonInput = document.getElementById("season");
  const teamSelect = document.getElementById("team");
  const categorySelect = document.getElementById("category");
  const tagSelect = document.getElementById("tag");
  const scoreInput = document.getElementById("score");
  const noteInput = document.getElementById("note");
  const occurredAtInput = document.getElementById("occurred-at");

  wireFastEvents();
  bootstrapFastUI();

  function wireFastEvents() {
    categorySelect?.addEventListener("change", renderContextSummary);
    tagSelect?.addEventListener("change", renderContextSummary);
    observeSelectMutations(teamSelect, renderClanButtons);
    observeSelectMutations(categorySelect, bootstrapDefaults);
    observeSelectMutations(tagSelect, bootstrapDefaults);
  }

  function bootstrapFastUI(retry = 0) {
    if (!seasonInput || !teamSelect || !categorySelect || !tagSelect || !scoreInput || !occurredAtInput) return;
    if (!teamSelect.options.length || !categorySelect.options.length || !tagSelect.options.length) {
      if (retry < 40) window.setTimeout(() => bootstrapFastUI(retry + 1), 120);
      return;
    }

    bootstrapDefaults();
    renderClanButtons();
    renderLastEntry();
  }

  function bootstrapDefaults() {
    if (!seasonInput.value) seasonInput.value = getCurrentSeasonCodeLocal();
    if (!optionExists(categorySelect, categorySelect.value)) categorySelect.value = categorySelect.options[0]?.value || "";
    if (!optionExists(tagSelect, tagSelect.value)) tagSelect.value = tagSelect.options[0]?.value || "";
    scoreInput.value = "1";
    noteInput.value = "";
    occurredAtInput.value = getNowLocalValue();
    if (seasonLabel) seasonLabel.textContent = `Saison active: ${seasonInput.value}`;
    renderContextSummary();
  }

  function renderClanButtons() {
    if (!clanButtons) return;
    const teams = getSelectValues(teamSelect);
    if (!teams.length) {
      clanButtons.innerHTML = '<p class="note">Aucun clan disponible.</p>';
      return;
    }

    clanButtons.innerHTML = teams.map((team) => renderTeamButton(team)).join("");
    clanButtons.querySelectorAll("button[data-team]").forEach((button) => {
      button.addEventListener("click", () => submitFastPoint(button.dataset.team || ""));
    });
  }

  async function submitFastPoint(team) {
    if (!team) return;
    if (typeof isAdmin === "function" && !isAdmin()) {
      showFastFeedback("Session admin inactive. Reconnecte-toi.", "error");
      return;
    }

    const season = normalizeSeasonCodeLocal(seasonInput?.value) || getCurrentSeasonCodeLocal();
    const category = categorySelect?.value || "";
    const tag = tagSelect?.value || "";
    if (!season || !category || !tag) {
      showFastFeedback("Selection invalide. Verifie la categorie et l'event tag.", "error");
      return;
    }

    seasonInput.value = season;
    teamSelect.value = team;
    scoreInput.value = "1";
    noteInput.value = "";
    occurredAtInput.value = getNowLocalValue();

    if (typeof state === "undefined" || !Array.isArray(state.entries) || typeof persistEntries !== "function") {
      showFastFeedback("Etat de score indisponible sur cette page.", "error");
      return;
    }

    try {
      state.entries.unshift({
        id: typeof createEntryId === "function" ? createEntryId() : `res-${Date.now()}`,
        season,
        team,
        category,
        tag,
        score: 1,
        note: "",
        occurredAt: occurredAtInput.value
      });
      await persistEntries();
      if (typeof refreshAllControls === "function") refreshAllControls(season);
      if (typeof renderAll === "function") renderAll();
      if (seasonLabel) seasonLabel.textContent = `Saison active: ${season}`;
      renderContextSummary();
      renderClanButtons();
      renderLastEntry();
      showFastFeedback(`1 point ajoute a ${team} (${category} / ${tag}).`, "success");
    } catch {
      showFastFeedback("Erreur pendant l'ajout du point.", "error");
    }
  }

  function renderLastEntry() {
    if (!lastEntry) return;
    if (typeof state === "undefined" || !Array.isArray(state.entries) || !state.entries.length) {
      lastEntry.textContent = "";
      return;
    }
    const latest = state.entries[0];
    lastEntry.textContent = `Dernier ajout: ${latest.team} +${latest.score} (${latest.category}, ${latest.tag})`;
  }

  function renderContextSummary() {
    if (!currentSelection) return;
    const category = categorySelect?.value || "-";
    const tag = tagSelect?.value || "-";
    currentSelection.innerHTML = `<span class="fast-pill">Categorie: ${escapeHtmlLocal(category)}</span><span class="fast-pill">Event tag: ${escapeHtmlLocal(tag)}</span><span class="fast-pill">Valeur: +1</span>`;
  }

  function renderTeamButton(team) {
    const style = typeof getTeamStyle === "function" ? getTeamStyle(team) : { color: "#3f6de0", logo: "" };
    const logoHtml = style.logo
      ? `<img class="fast-team-logo" src="${escapeAttrLocal(style.logo)}" alt="Logo ${escapeAttrLocal(team)}" />`
      : "";
    return `<button type="button" class="fast-choice-btn" data-team="${escapeAttrLocal(team)}">
      <span class="fast-dot" style="background:${escapeAttrLocal(style.color || "#3f6de0")}"></span>${logoHtml}
      <span>${escapeHtmlLocal(team)}</span>
    </button>`;
  }

  function observeSelectMutations(selectElement, callback) {
    if (!selectElement || typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(() => {
      callback();
    });
    observer.observe(selectElement, { childList: true, subtree: true });
  }

  function getSelectValues(selectElement) {
    if (!selectElement) return [];
    return Array.from(selectElement.options)
      .map((option) => option.value)
      .filter((value) => value && value !== "all");
  }

  function optionExists(selectElement, value) {
    if (!selectElement) return false;
    return Array.from(selectElement.options).some((option) => option.value === value);
  }

  function normalizeSeasonCodeLocal(value) {
    const raw = String(value || "").trim().toUpperCase();
    return /^LK\d{2}$/.test(raw) ? raw : "";
  }

  function getCurrentSeasonCodeLocal() {
    const year = new Date().getFullYear();
    return `LK${String(year).slice(-2)}`;
  }

  function getNowLocalValue() {
    if (typeof getNowLocalDateTimeValue === "function") return getNowLocalDateTimeValue();
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  function showFastFeedback(message, type) {
    if (typeof showAdminFeedback === "function") {
      showAdminFeedback(message, type);
      return;
    }
    console[type === "error" ? "error" : "log"](message);
  }

  function escapeHtmlLocal(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttrLocal(value) {
    return escapeHtmlLocal(value).replace(/`/g, "&#96;");
  }
})();
