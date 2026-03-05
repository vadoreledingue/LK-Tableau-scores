(function () {
  const pageRoot = document.querySelector(".fast-point-add-page");
  if (!pageRoot) return;

  const fastSeasonInput = document.getElementById("fast-season-input");
  const fastSeasonPrev = document.getElementById("fast-season-prev");
  const fastSeasonNext = document.getElementById("fast-season-next");
  const fastStageTitle = document.getElementById("fast-stage-title");
  const fastStageBack = document.getElementById("fast-stage-back");
  const fastStageProgress = document.getElementById("fast-stage-progress");
  const fastStageContent = document.getElementById("fast-stage-content");
  const fastLastEntry = document.getElementById("fast-last-entry");

  const seasonInput = document.getElementById("season");
  const teamSelect = document.getElementById("team");
  const categorySelect = document.getElementById("category");
  const tagSelect = document.getElementById("tag");
  const scoreInput = document.getElementById("score");
  const noteInput = document.getElementById("note");
  const occurredAtInput = document.getElementById("occurred-at");
  const scoreForm = document.getElementById("score-form");

  const scoreSteps = [1, 2, 3, 5, 10, 15];
  const notePresets = ["Tour 1", "Tour 2", "Demi-finale", "Finale", "Bonus"];
  const stages = [
    { id: "team", title: "Clan" },
    { id: "category", title: "Categorie" },
    { id: "tag", title: "Tag" },
    { id: "score", title: "Score" },
    { id: "note", title: "Note et validation" }
  ];

  let currentStage = 0;
  let currentScore = 0;
  let didInitializeFlow = false;
  let teamOnlySwitchMode = false;

  wireFastEvents();
  bootstrapFastUI();

  function wireFastEvents() {
    fastSeasonPrev?.addEventListener("click", () => shiftSeason(-1));
    fastSeasonNext?.addEventListener("click", () => shiftSeason(1));
    fastSeasonInput?.addEventListener("input", syncSeasonBridge);
    fastStageBack?.addEventListener("click", goBackStage);
    fastStageContent?.addEventListener("click", handleStageClick);
    fastStageContent?.addEventListener("input", handleStageInput);

    observeSelectMutations(teamSelect);
    observeSelectMutations(categorySelect);
    observeSelectMutations(tagSelect);
  }

  function bootstrapFastUI(retry = 0) {
    if (!seasonInput || !teamSelect || !categorySelect || !tagSelect || !scoreInput || !scoreForm) return;
    if (!teamSelect.options.length || !categorySelect.options.length || !tagSelect.options.length) {
      if (retry < 40) window.setTimeout(() => bootstrapFastUI(retry + 1), 120);
      return;
    }

    if (!seasonInput.value) seasonInput.value = getCurrentSeasonCodeLocal();
    if (fastSeasonInput) fastSeasonInput.value = seasonInput.value;
    if (occurredAtInput && !occurredAtInput.value) occurredAtInput.value = getNowLocalValue();

    if (!didInitializeFlow) {
      teamSelect.value = "";
      categorySelect.value = "";
      tagSelect.value = "";
      scoreInput.value = "0";
      noteInput.value = "";
      currentScore = 0;
      currentStage = 0;
      didInitializeFlow = true;
    } else {
      currentScore = Math.max(0, Number(scoreInput.value) || 0);
      currentStage = inferCurrentStage();
    }

    renderStage();
    renderLastEntry();
  }

  function renderStage() {
    const stage = stages[currentStage] || stages[0];
    if (fastStageTitle) {
      fastStageTitle.textContent = stage.id === "note" && teamOnlySwitchMode ? "Finaliser" : stage.title;
    }
    if (fastStageProgress) fastStageProgress.textContent = `${currentStage + 1}/${stages.length}`;
    if (fastStageBack) fastStageBack.classList.toggle("hidden", currentStage <= 0);
    if (!fastStageContent) return;

    if (stage.id === "team") {
      fastStageContent.innerHTML = renderTeamStage();
      return;
    }
    if (stage.id === "category") {
      fastStageContent.innerHTML = renderCategoryStage();
      return;
    }
    if (stage.id === "tag") {
      fastStageContent.innerHTML = renderTagStage();
      return;
    }
    if (stage.id === "score") {
      fastStageContent.innerHTML = renderScoreStage();
      return;
    }
    fastStageContent.innerHTML = renderNoteStage();
  }

  function renderTeamStage() {
    const teams = getSelectValues(teamSelect);
    const canSwitchOnly = Boolean(categorySelect?.value && tagSelect?.value && currentScore > 0);
    const modeLabel = teamOnlySwitchMode
      ? '<p class="note">Mode actif: changement de clan uniquement.</p>'
      : "";
    const modeButton = `<div class="fast-stage-actions"><button type="button" class="ghost" data-action="switch-team-only"${canSwitchOnly ? "" : " disabled"}>Activer: changer clan seulement</button></div>`;
    return `${modeLabel}${modeButton}<div class="fast-grid">${teams
      .map((team) => renderTeamButton(team, team === teamSelect?.value))
      .join("")}</div>`;
  }

  function renderCategoryStage() {
    const values = getSelectValues(categorySelect);
    const martial = values.filter((value) => isCategoryType(value, "martial"));
    const narrative = values.filter((value) => isCategoryType(value, "narrative"));
    const others = values.filter((value) => !isCategoryType(value, "martial") && !isCategoryType(value, "narrative"));
    if (others.length) {
      martial.push(...others);
    }

    return `<div class="fast-category-columns">
      <section class="fast-col">
        <h4>Martial</h4>
        <div class="fast-grid fast-grid-tight">
          ${martial.map((value) => renderChoiceButton(value, value === categorySelect?.value)).join("")}
        </div>
      </section>
      <section class="fast-col">
        <h4>Narrative</h4>
        <div class="fast-grid fast-grid-tight">
          ${narrative.map((value) => renderChoiceButton(value, value === categorySelect?.value)).join("")}
        </div>
      </section>
    </div>`;
  }

  function renderTagStage() {
    const values = getSelectValues(tagSelect);
    return `<div class="fast-grid fast-grid-tight">${values
      .map((tag) => renderChoiceButton(tag, tag === tagSelect?.value))
      .join("")}</div>`;
  }

  function renderScoreStage() {
    const steps = scoreSteps.map((step) => `<button type="button" data-action="score-add" data-delta="${step}">+${step}</button>`).join("");
    return `<div class="fast-score-box">
      <button type="button" class="ghost" data-action="score-minus">-1</button>
      <p class="fast-score-value">${currentScore}</p>
      <button type="button" data-action="score-plus">+1</button>
    </div>
    <div class="fast-grid fast-grid-tight">${steps}</div>
    <div class="fast-stage-actions">
      <button type="button" class="ghost" data-action="score-reset">Reinitialiser</button>
      <button type="button" data-action="score-next"${currentScore <= 0 ? " disabled" : ""}>Continuer</button>
    </div>`;
  }

  function renderNoteStage() {
    if (teamOnlySwitchMode) {
      const summaryTeam = teamSelect?.value || "Clan non defini";
      const summaryCategory = categorySelect?.value || "Categorie non definie";
      const summaryTag = tagSelect?.value || "Tag non defini";
      return `<div class="fast-col">
        <h4>Resume</h4>
        <p class="note">Clan: ${escapeHtmlLocal(summaryTeam)}</p>
        <p class="note">Categorie: ${escapeHtmlLocal(summaryCategory)}</p>
        <p class="note">Tag: ${escapeHtmlLocal(summaryTag)}</p>
        <p class="note">Score: +${currentScore}</p>
      </div>
      <div class="fast-stage-actions">
        <button type="button" class="fast-submit" data-action="submit-team-only">Finaliser et ajouter le score</button>
      </div>`;
    }

    const presets = notePresets
      .map((note) => `<button type="button" data-action="note-preset" data-note="${escapeAttrLocal(note)}">${escapeHtmlLocal(note)}</button>`)
      .join("");
    const team = teamSelect?.value || "Clan";
    const category = categorySelect?.value || "Categorie";
    return `<div class="fast-grid fast-grid-tight">${presets}</div>
    <label>
      Note libre
      <input id="fast-note-input" type="text" maxlength="80" placeholder="Ex: Duel final" value="${escapeAttrLocal(noteInput?.value || "")}" />
    </label>
    <div class="fast-stage-actions">
      <button type="button" class="ghost" data-action="switch-team-only">Changer clan seulement</button>
      <button type="button" data-action="submit-switch-clan">Ajouter et changer clan</button>
      <button type="button" class="fast-submit" data-action="submit">Ajouter +${currentScore} (${escapeHtmlLocal(team)} / ${escapeHtmlLocal(category)})</button>
    </div>`;
  }

  function handleStageClick(event) {
    const targetButton = event.target.closest("button");
    if (!targetButton) return;

    const value = targetButton.dataset.value;
    if (value) {
      handleStageSelect(value);
      return;
    }

    const action = targetButton.dataset.action;
    if (!action) return;

    if (action === "score-minus") {
      setScore(currentScore - 1);
      return;
    }
    if (action === "score-plus") {
      setScore(currentScore + 1);
      return;
    }
    if (action === "score-reset") {
      setScore(0);
      return;
    }
    if (action === "score-add") {
      setScore(currentScore + Number(targetButton.dataset.delta || 0));
      return;
    }
    if (action === "score-next") {
      if (currentScore <= 0) return;
      currentStage = 4;
      renderStage();
      return;
    }
    if (action === "note-preset") {
      if (!noteInput) return;
      noteInput.value = targetButton.dataset.note || "";
      renderStage();
      return;
    }
    if (action === "switch-team-only") {
      if (!categorySelect?.value || !tagSelect?.value || currentScore <= 0) {
        showFastFeedback("Selectionne d'abord categorie, tag et score.", "error");
        return;
      }
      teamOnlySwitchMode = true;
      currentStage = 0;
      renderStage();
      return;
    }
    if (action === "submit-team-only") {
      submitFastScore({ keepLastEntry: true });
      return;
    }
    if (action === "submit") {
      submitFastScore({ keepLastEntry: false });
      return;
    }
    if (action === "submit-switch-clan") {
      submitFastScore({ keepLastEntry: true });
    }
  }

  function handleStageInput(event) {
    const input = event.target.closest("#fast-note-input");
    if (!input || !noteInput) return;
    noteInput.value = input.value.trim();
  }

  function handleStageSelect(value) {
    const stageId = stages[currentStage]?.id;
    if (stageId === "team" && teamSelect) {
      teamSelect.value = value;
      if (teamOnlySwitchMode) {
        currentStage = 4;
      } else {
        currentStage = 1;
      }
      renderStage();
      return;
    }
    if (stageId === "category" && categorySelect) {
      categorySelect.value = value;
      currentStage = 2;
      renderStage();
      return;
    }
    if (stageId === "tag" && tagSelect) {
      tagSelect.value = value;
      currentStage = 3;
      renderStage();
    }
  }

  function goBackStage() {
    if (currentStage <= 0) return;
    const stageId = stages[currentStage]?.id;
    if (stageId === "tag" && tagSelect) tagSelect.value = "";
    if (stageId === "category" && categorySelect) {
      categorySelect.value = "";
      if (tagSelect) tagSelect.value = "";
    }
    if (stageId === "team" && teamSelect) {
      teamSelect.value = "";
    }
    currentStage -= 1;
    teamOnlySwitchMode = false;
    renderStage();
  }

  function setScore(value) {
    currentScore = Math.max(0, Math.floor(Number(value) || 0));
    if (scoreInput) scoreInput.value = String(currentScore);
    renderStage();
  }

  function submitFastScore(options = {}) {
    const keepLastEntry = Boolean(options.keepLastEntry);
    if (typeof isAdmin === "function" && !isAdmin()) {
      showFastFeedback("Session admin inactive. Reconnecte-toi.", "error");
      return;
    }
    if (!scoreForm || !seasonInput || !teamSelect || !categorySelect || !tagSelect || !scoreInput || !occurredAtInput) return;

    syncSeasonBridge();
    occurredAtInput.value = getNowLocalValue();
    const season = normalizeSeasonCodeLocal(seasonInput.value);
    if (!season) {
      showFastFeedback("Format saison invalide. Utilise LK26, LK27, etc.", "error");
      return;
    }
    if (!teamSelect.value || !categorySelect.value || !tagSelect.value || currentScore <= 0) {
      showFastFeedback("Champs incomplets pour ajouter le score.", "error");
      return;
    }

    seasonInput.value = season;
    scoreInput.value = String(currentScore);
    if (typeof scoreForm.requestSubmit === "function") {
      scoreForm.requestSubmit();
    } else {
      scoreForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    }

    window.setTimeout(() => {
      if (keepLastEntry) {
        teamOnlySwitchMode = true;
        currentStage = 0;
        if (teamSelect) teamSelect.value = "";
      } else {
        currentScore = 0;
        scoreInput.value = "0";
        noteInput.value = "";
        teamOnlySwitchMode = false;
        currentStage = 0;
        if (teamSelect) teamSelect.value = "";
        if (categorySelect) categorySelect.value = "";
        if (tagSelect) tagSelect.value = "";
      }
      renderStage();
      renderLastEntry();
    }, 90);
  }

  function observeSelectMutations(selectElement) {
    if (!selectElement || typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(() => {
      if (!optionExists(selectElement, selectElement.value)) selectElement.value = "";
      currentStage = Math.min(currentStage, inferCurrentStage());
      renderStage();
    });
    observer.observe(selectElement, { childList: true, subtree: true });
  }

  function inferCurrentStage() {
    if (!teamSelect?.value) return 0;
    if (!categorySelect?.value) return 1;
    if (!tagSelect?.value) return 2;
    if ((Number(scoreInput?.value) || 0) <= 0) return 3;
    return 4;
  }

  function renderTeamButton(team, active) {
    const style = typeof getTeamStyle === "function" ? getTeamStyle(team) : { color: "#3f6de0", logo: "" };
    const logoHtml = style.logo
      ? `<img class="fast-team-logo" src="${escapeAttrLocal(style.logo)}" alt="Logo ${escapeAttrLocal(team)}" />`
      : "";
    return `<button type="button" class="fast-choice-btn${active ? " is-active" : ""}" data-value="${escapeAttrLocal(team)}">
      <span class="fast-dot" style="background:${escapeAttrLocal(style.color || "#3f6de0")}"></span>${logoHtml}
      <span>${escapeHtmlLocal(team)}</span>
    </button>`;
  }

  function renderChoiceButton(value, active) {
    return `<button type="button" class="fast-choice-btn${active ? " is-active" : ""}" data-value="${escapeAttrLocal(value)}">${escapeHtmlLocal(value)}</button>`;
  }

  function isCategoryType(value, target) {
    if (target === "martial" && typeof isMartialCategory === "function") return isMartialCategory(value);
    if (target === "narrative" && typeof isNarrativeCategory === "function") return isNarrativeCategory(value);
    return false;
  }

  function renderLastEntry() {
    if (!fastLastEntry) return;
    if (typeof state === "undefined" || !Array.isArray(state.entries) || !state.entries.length) {
      fastLastEntry.textContent = "";
      return;
    }
    const last = state.entries[0];
    fastLastEntry.textContent = `Dernier ajout: ${last.team} +${last.score} (${last.category}, ${last.tag})`;
  }

  function getSelectValues(selectElement) {
    if (!selectElement) return [];
    return Array.from(selectElement.options).map((o) => o.value).filter((v) => v && v !== "all");
  }

  function optionExists(selectElement, value) {
    if (!selectElement) return false;
    return Array.from(selectElement.options).some((option) => option.value === value);
  }

  function syncSeasonBridge() {
    if (!fastSeasonInput || !seasonInput) return;
    const normalized = normalizeSeasonCodeLocal(fastSeasonInput.value);
    seasonInput.value = normalized || fastSeasonInput.value.toUpperCase();
    if (normalized) fastSeasonInput.value = normalized;
  }

  function shiftSeason(delta) {
    if (!fastSeasonInput) return;
    const normalized = normalizeSeasonCodeLocal(fastSeasonInput.value) || getCurrentSeasonCodeLocal();
    const year = Number(normalized.slice(2));
    if (!Number.isFinite(year)) return;
    const next = `LK${String((year + delta + 100) % 100).padStart(2, "0")}`;
    fastSeasonInput.value = next;
    syncSeasonBridge();
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
