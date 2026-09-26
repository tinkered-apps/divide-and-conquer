// All learner data lives in this browser. One localStorage entry holds every
// profile on the device; nothing is sent to a server. The mastery rules here
// are the ones the app has always used for spacing reviews.
const STORE = (() => {
  const STORAGE_KEY = 'divide-and-conquer-data';
  const FORMAT_VERSION = 1;
  const ALLOWED_SESSION_MINUTES = new Set([1, 2, 3, 5, 10]);
  const DEFAULT_SESSION_MINUTES = 2;
  const MAX_NAME_LENGTH = 30;
  const MAX_PROFILES = 20;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const REVIEW_DAYS_AFTER_PROMOTION = [0, 0, 1, 3, 7, 14];
  const MAINTENANCE_DAYS = 30;
  const STAT_TYPES = ['multiplication', 'division', 'missingFactor'];
  const REVIEW_MODES = { multiply: 'multiplication', divide: 'division' };

  function iso(date = new Date()) {
    return date.toISOString();
  }

  function computeMasteryUpdate(current, correct, now = new Date()) {
    const answeredAt = iso(now);
    const wasDue = !current.dueAt || new Date(current.dueAt).getTime() <= now.getTime();
    let stage = current.stage || 0;
    let dueAt = current.dueAt || answeredAt;

    if (!correct) {
      stage = Math.max(0, stage - 2);
      dueAt = answeredAt;
    } else if (wasDue) {
      if (stage < 5) {
        stage += 1;
        const days = REVIEW_DAYS_AFTER_PROMOTION[stage];
        dueAt = days === 0 ? answeredAt : iso(new Date(now.getTime() + days * DAY_MS));
      } else {
        dueAt = iso(new Date(now.getTime() + MAINTENANCE_DAYS * DAY_MS));
      }
    }

    return { stage, dueAt, lastAnsweredAt: answeredAt, lastResult: Boolean(correct) };
  }

  // ─── Fact keys ───────────────────────────────────
  const isInt = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;

  function validKeys(type, keyA, keyB) {
    if (type === 'multiplication') return isInt(keyA, 1, 10) && isInt(keyB, 1, 10);
    if (type === 'division') {
      return isInt(keyA, 1, 100) && isInt(keyB, 1, 10) &&
        keyA % keyB === 0 && isInt(keyA / keyB, 1, 10);
    }
    if (type === 'missingFactor') {
      return isInt(keyA, 1, 10) && isInt(keyB, 1, 100) &&
        keyB % keyA === 0 && isInt(keyB / keyA, 1, 10);
    }
    return false;
  }

  // Commutative multiplication facts share one record.
  function normalizeKeys(type, keyA, keyB) {
    if (type === 'multiplication' && keyA > keyB) return [keyB, keyA];
    return [keyA, keyB];
  }

  function parseKey(key) {
    const parts = String(key).split(',');
    if (parts.length !== 2) return null;
    const [a, b] = parts.map(Number);
    return Number.isInteger(a) && Number.isInteger(b) ? [a, b] : null;
  }

  function withKeys(type, keyA, keyB, record) {
    if (type === 'multiplication') return { factorA: keyA, factorB: keyB, ...record };
    if (type === 'division') return { dividend: keyA, divisor: keyB, ...record };
    return { factorA: keyA, product: keyB, ...record };
  }

  // ─── Validation of anything read from storage or a backup file ───
  const isDate = value => typeof value === 'string' && !Number.isNaN(Date.parse(value));
  const count = value => (isInt(value, 0, 1e6) ? value : 0);

  function cleanStat(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const stat = {
      correct: count(raw.correct),
      incorrect: count(raw.incorrect),
      stage: isInt(raw.stage, 0, 5) ? raw.stage : 0,
      dueAt: isDate(raw.dueAt) ? raw.dueAt : null,
      lastAnsweredAt: isDate(raw.lastAnsweredAt) ? raw.lastAnsweredAt : null,
      lastResult: typeof raw.lastResult === 'boolean' ? raw.lastResult : null,
    };
    return stat.correct + stat.incorrect > 0 ? stat : null;
  }

  function cleanName(raw) {
    if (typeof raw !== 'string') return null;
    const name = raw.trim().slice(0, MAX_NAME_LENGTH);
    return name || null;
  }

  function cleanProfile(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const name = cleanName(raw.name);
    const id = typeof raw.id === 'string' && /^[A-Za-z0-9-]{1,64}$/.test(raw.id) ? raw.id : null;
    if (!name || !id) return null;

    const stats = {};
    for (const type of STAT_TYPES) {
      stats[type] = {};
      const source = raw.stats?.[type];
      if (!source || typeof source !== 'object') continue;
      for (const [key, value] of Object.entries(source)) {
        const keys = parseKey(key);
        if (!keys || !validKeys(type, ...keys)) continue;
        const [a, b] = normalizeKeys(type, ...keys);
        const stat = cleanStat(value);
        if (stat) stats[type][`${a},${b}`] = stat;
      }
    }

    const reviewMarks = {};
    for (const [mode, type] of Object.entries(REVIEW_MODES)) {
      reviewMarks[mode] = {};
      const source = raw.reviewMarks?.[mode];
      if (!source || typeof source !== 'object') continue;
      for (const [key, value] of Object.entries(source)) {
        const keys = parseKey(key);
        if (!keys || !validKeys(type, ...keys)) continue;
        if (value !== 'correct' && value !== 'incorrect') continue;
        const [a, b] = normalizeKeys(type, ...keys);
        reviewMarks[mode][`${a},${b}`] = value;
      }
    }

    return {
      id,
      name,
      createdAt: isDate(raw.createdAt) ? raw.createdAt : iso(),
      sessionMinutes: ALLOWED_SESSION_MINUTES.has(raw.sessionMinutes)
        ? raw.sessionMinutes
        : DEFAULT_SESSION_MINUTES,
      stats,
      reviewMarks,
    };
  }

  function cleanData(raw) {
    const data = { version: FORMAT_VERSION, currentProfileId: null, lastBackupAt: null, profiles: {} };
    if (!raw || typeof raw !== 'object' || raw.version !== FORMAT_VERSION) return data;
    const profiles = raw.profiles && typeof raw.profiles === 'object' ? Object.values(raw.profiles) : [];
    for (const candidate of profiles.slice(0, MAX_PROFILES)) {
      const profile = cleanProfile(candidate);
      if (profile) data.profiles[profile.id] = profile;
    }
    if (data.profiles[raw.currentProfileId]) data.currentProfileId = raw.currentProfileId;
    if (isDate(raw.lastBackupAt)) data.lastBackupAt = raw.lastBackupAt;
    return data;
  }

  function createStore(storage, options = {}) {
    const clock = options.now || (() => new Date());
    const makeId = options.makeId || (() =>
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
    let memory = cleanData(null);
    let storageWorks = true;

    // Re-read on every operation so two open tabs do not overwrite each other.
    function load() {
      if (!storageWorks) return memory;
      try {
        memory = cleanData(JSON.parse(storage.getItem(STORAGE_KEY)));
      } catch {
        // Unreadable entry: keep what this page already has.
      }
      return memory;
    }

    function save() {
      if (!storageWorks) return false;
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(memory));
        return true;
      } catch {
        // Storage blocked or full: keep working in memory for this page.
        storageWorks = false;
        return false;
      }
    }

    function publicProfile(profile) {
      if (!profile) return null;
      return { id: profile.id, name: profile.name, sessionMinutes: profile.sessionMinutes };
    }

    function current() {
      const data = load();
      return data.profiles[data.currentProfileId] || null;
    }

    function requireCurrent() {
      const profile = current();
      if (!profile) throw new Error('No learner selected');
      return profile;
    }

    // ─── Profiles ──────────────────────────────────
    function listProfiles() {
      return Object.values(load().profiles)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map(publicProfile);
    }

    function createProfile(rawName) {
      const name = cleanName(rawName);
      if (!name) throw new Error('Name required');
      const data = load();
      if (Object.keys(data.profiles).length >= MAX_PROFILES) throw new Error('Too many learners');
      const profile = cleanProfile({ id: makeId(), name, createdAt: iso(clock()) });
      data.profiles[profile.id] = profile;
      data.currentProfileId = profile.id;
      save();
      return publicProfile(profile);
    }

    function selectProfile(id) {
      const data = load();
      if (!data.profiles[id]) return null;
      data.currentProfileId = id;
      save();
      return publicProfile(data.profiles[id]);
    }

    function signOut() {
      load().currentProfileId = null;
      save();
    }

    function deleteProfile(id) {
      const data = load();
      if (!data.profiles[id]) return false;
      delete data.profiles[id];
      if (data.currentProfileId === id) data.currentProfileId = null;
      save();
      return true;
    }

    function updateSessionMinutes(minutes) {
      if (!ALLOWED_SESSION_MINUTES.has(minutes)) return false;
      requireCurrent().sessionMinutes = minutes;
      return save();
    }

    // ─── Practice results ──────────────────────────
    function getStats(type) {
      const records = requireCurrent().stats[type] || {};
      return Object.entries(records).map(([key, stat]) => {
        const [a, b] = parseKey(key);
        return withKeys(type, a, b, { ...stat });
      });
    }

    function recordAttempt(type, rawKeyA, rawKeyB, correct) {
      if (!validKeys(type, rawKeyA, rawKeyB)) throw new Error('Invalid fact');
      const [keyA, keyB] = normalizeKeys(type, rawKeyA, rawKeyB);
      const records = requireCurrent().stats[type];
      const key = `${keyA},${keyB}`;
      const now = clock();
      const existing = records[key] || { correct: 0, incorrect: 0, stage: 0, dueAt: iso(now) };
      const stat = {
        ...existing,
        correct: existing.correct + (correct ? 1 : 0),
        incorrect: existing.incorrect + (correct ? 0 : 1),
        ...computeMasteryUpdate(existing, correct, now),
      };
      records[key] = stat;
      save();
      return withKeys(type, keyA, keyB, { ...stat });
    }

    // ─── Learn / review marks ──────────────────────
    function getReviewMarks(mode) {
      const marks = requireCurrent().reviewMarks[mode] || {};
      return Object.entries(marks).map(([key, state]) => {
        const [keyA, keyB] = parseKey(key);
        return { keyA, keyB, state };
      });
    }

    // A green mark counts as a first correct recall; a red one as a mistake.
    function setReviewMark(mode, rawKeyA, rawKeyB, state) {
      const type = REVIEW_MODES[mode];
      if (!type || !validKeys(type, rawKeyA, rawKeyB) ||
        !['none', 'correct', 'incorrect'].includes(state)) {
        throw new Error('Invalid review mark');
      }
      const [keyA, keyB] = normalizeKeys(type, rawKeyA, rawKeyB);
      const profile = requireCurrent();
      const marks = profile.reviewMarks[mode];
      const key = `${keyA},${keyB}`;
      if ((marks[key] || 'none') === state) return { keyA, keyB, state, unchanged: true };

      if (state === 'none') {
        delete marks[key];
        save();
        return { keyA, keyB, state };
      }

      marks[key] = state;
      if (state === 'correct') {
        const records = profile.stats[type];
        const now = iso(clock());
        const existing = records[key] || { correct: 0, incorrect: 0, stage: 0, dueAt: now };
        records[key] = {
          ...existing,
          correct: existing.correct + 1,
          stage: Math.max(existing.stage, 1),
          dueAt: existing.stage < 1 ? now : existing.dueAt,
          lastAnsweredAt: now,
          lastResult: true,
        };
        save();
      } else {
        save();
        recordAttempt(type, keyA, keyB, false);
      }
      return { keyA, keyB, state };
    }

    function clearReviewMarks(mode) {
      if (!REVIEW_MODES[mode]) return;
      requireCurrent().reviewMarks[mode] = {};
      save();
    }

    // ─── Backup ────────────────────────────────────
    function exportData() {
      const data = load();
      data.lastBackupAt = iso(clock());
      save();
      return {
        app: 'divide-and-conquer',
        version: FORMAT_VERSION,
        exportedAt: data.lastBackupAt,
        profiles: Object.values(data.profiles),
      };
    }

    // Adds the learners from a backup file. A learner that already exists on
    // this device (same id) is replaced by the copy from the file.
    function importData(raw) {
      if (!raw || typeof raw !== 'object' || raw.app !== 'divide-and-conquer' ||
        raw.version !== FORMAT_VERSION || !Array.isArray(raw.profiles)) {
        throw new Error('Not a Divide & Conquer backup');
      }
      const data = load();
      let imported = 0;
      for (const candidate of raw.profiles) {
        const profile = cleanProfile(candidate);
        if (!profile) continue;
        const isNew = !data.profiles[profile.id];
        if (isNew && Object.keys(data.profiles).length >= MAX_PROFILES) break;
        data.profiles[profile.id] = profile;
        imported += 1;
      }
      if (!imported) throw new Error('No learners found in the file');
      save();
      return imported;
    }

    function lastBackupAt() {
      return load().lastBackupAt;
    }

    function hasProgress() {
      return Object.values(load().profiles).some(profile =>
        STAT_TYPES.some(type => Object.keys(profile.stats[type]).length));
    }

    return {
      current: () => publicProfile(current()),
      listProfiles,
      createProfile,
      selectProfile,
      signOut,
      deleteProfile,
      updateSessionMinutes,
      getStats,
      recordAttempt,
      getReviewMarks,
      setReviewMark,
      clearReviewMarks,
      exportData,
      importData,
      lastBackupAt,
      hasProgress,
    };
  }

  // Ask the browser not to evict this site's storage (installed apps and
  // frequently used sites are usually granted this).
  function requestPersistence() {
    try {
      navigator.storage?.persist?.().catch(() => {});
    } catch {
      // Not supported: nothing to do.
    }
  }

  const api = {
    STORAGE_KEY,
    ALLOWED_SESSION_MINUTES,
    MAX_NAME_LENGTH,
    computeMasteryUpdate,
    createStore,
    requestPersistence,
  };

  if (typeof window !== 'undefined') {
    let storage;
    try {
      storage = window.localStorage;
    } catch {
      storage = null;
    }
    Object.assign(api, createStore(storage || { getItem: () => null, setItem: () => {} }));
  }
  return api;
})();

if (typeof module !== 'undefined') module.exports = STORE;
