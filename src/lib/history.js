const STORAGE_KEY = "evidence-engine-history";
const MAX_ENTRIES = 50;

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // localStorage can throw if full/unavailable (private browsing, quota) —
    // history is a convenience feature, not critical path, so fail silently.
  }
}

export function getHistory() {
  return readAll().sort((a, b) => b.savedAt - a.savedAt);
}

export function saveDebateToHistory(question, debate) {
  const entries = readAll();
  const entry = {
    id: crypto.randomUUID(),
    question,
    savedAt: Date.now(),
    debate,
  };
  const next = [entry, ...entries].slice(0, MAX_ENTRIES);
  writeAll(next);
  return entry;
}

export function deleteFromHistory(id) {
  writeAll(readAll().filter((e) => e.id !== id));
}

export function clearHistory() {
  writeAll([]);
}
