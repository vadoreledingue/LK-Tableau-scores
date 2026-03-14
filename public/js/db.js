(function () {
  const RESULTS_DB_NAME = "kinshima-results-db";
  const RESULTS_STORE_NAME = "results";
  const SETTINGS_STORE_NAME = "settings";
  const RESULTS_FALLBACK_KEY = "kinshima-results-fallback-v1";
  const MIGRATION_MARKER_KEY = "kinshima-results-db-migrated-v1";
  const ADMIN_SECURITY_KEY = "admin-security";

  let resultsDbPromise = null;

  async function bootstrapEntriesStorage(params) {
    const { currentEntries, defaultEntries, normalizeEntry } = params || {};
    const normalize = typeof normalizeEntry === "function" ? normalizeEntry : (entry) => entry;

    const dbEntries = await loadEntriesFromDatabase();
    if (dbEntries.length) {
      return dbEntries.map((entry) => normalize(entry));
    }

    if (!localStorage.getItem(MIGRATION_MARKER_KEY)) {
      const migrated = (Array.isArray(currentEntries) ? currentEntries : []).map((entry) => normalize(entry));
      await saveEntriesToDatabase(migrated);
      localStorage.setItem(MIGRATION_MARKER_KEY, "1");
      localStorage.removeItem(RESULTS_FALLBACK_KEY);
      return migrated;
    }

    const defaults = (Array.isArray(defaultEntries) ? defaultEntries : []).map((entry) => normalize(entry));
    await saveEntriesToDatabase(defaults);
    return defaults;
  }

  async function persistEntries(params) {
    const { entries, normalizeEntry } = params || {};
    const normalize = typeof normalizeEntry === "function" ? normalizeEntry : (entry) => entry;
    const normalized = (Array.isArray(entries) ? entries : []).map((entry) => normalize(entry));
    await saveEntriesToDatabase(normalized);
    return normalized;
  }

  async function loadAdminSecurity() {
    if (typeof indexedDB === "undefined") return null;
    try {
      const db = await getResultsDb();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(SETTINGS_STORE_NAME, "readonly");
        const store = tx.objectStore(SETTINGS_STORE_NAME);
        const request = store.get(ADMIN_SECURITY_KEY);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error || new Error("db-read-admin-security-error"));
      });
    } catch {
      return null;
    }
  }

  async function saveAdminSecurity(securityState) {
    if (typeof indexedDB === "undefined") return;
    try {
      const db = await getResultsDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(SETTINGS_STORE_NAME, "readwrite");
        const store = tx.objectStore(SETTINGS_STORE_NAME);
        store.put(securityState, ADMIN_SECURITY_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error("db-write-admin-security-error"));
        tx.onabort = () => reject(tx.error || new Error("db-admin-security-abort"));
      });
    } catch {
      // ignore: localStorage fallback is still used by the app
    }
  }

  async function loadEntriesFromDatabase() {
    if (typeof indexedDB === "undefined") return loadFallbackEntries();
    try {
      const db = await getResultsDb();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(RESULTS_STORE_NAME, "readonly");
        const store = tx.objectStore(RESULTS_STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
        request.onerror = () => reject(request.error || new Error("db-read-error"));
      });
    } catch {
      return loadFallbackEntries();
    }
  }

  async function saveEntriesToDatabase(entries) {
    if (typeof indexedDB === "undefined") {
      saveFallbackEntries(entries);
      return;
    }
    try {
      const db = await getResultsDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(RESULTS_STORE_NAME, "readwrite");
        const store = tx.objectStore(RESULTS_STORE_NAME);
        store.clear();
        entries.forEach((entry, index) => store.put(entry, index));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error("db-write-error"));
        tx.onabort = () => reject(tx.error || new Error("db-abort"));
      });
    } catch {
      saveFallbackEntries(entries);
    }
  }

  function getResultsDb() {
    if (!resultsDbPromise) {
      resultsDbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(RESULTS_DB_NAME, 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(RESULTS_STORE_NAME)) {
            db.createObjectStore(RESULTS_STORE_NAME);
          }
          if (!db.objectStoreNames.contains(SETTINGS_STORE_NAME)) {
            db.createObjectStore(SETTINGS_STORE_NAME);
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("db-open-error"));
      });
    }
    return resultsDbPromise;
  }

  function loadFallbackEntries() {
    const raw = localStorage.getItem(RESULTS_FALLBACK_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveFallbackEntries(entries) {
    localStorage.setItem(RESULTS_FALLBACK_KEY, JSON.stringify(entries));
  }

  window.KinshimaResultsDB = {
    bootstrapEntriesStorage,
    persistEntries,
    loadAdminSecurity,
    saveAdminSecurity
  };
})();
