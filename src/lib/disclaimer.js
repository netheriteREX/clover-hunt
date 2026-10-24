const STORAGE_KEY = "clover-hunt-disclaimer-seen";

export function hasSeenDisclaimer() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // localStorage can throw if unavailable (private browsing, quota) —
    // default to showing the disclaimer rather than silently skipping it.
    return false;
  }
}

export function markDisclaimerSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Non-critical if this fails — worst case the disclaimer reappears
    // next visit.
  }
}
