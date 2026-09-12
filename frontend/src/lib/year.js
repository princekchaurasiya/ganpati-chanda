// Global active-year store. Persisted in localStorage. Components can call
// useActiveYear() to read/set it; every setter triggers a full app reload
// so all pages re-fetch data cleanly for the newly selected year.
const KEY = "chanda_active_year";
const DEFAULT_YEAR = String(new Date().getFullYear());

export function getActiveYear() {
  try {
    return localStorage.getItem(KEY) || DEFAULT_YEAR;
  } catch {
    return DEFAULT_YEAR;
  }
}

export function setActiveYear(year) {
  try {
    if (!year || year === "all") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, String(year));
  } catch {}
  // Reload so every page picks up new year via axios interceptor
  window.location.reload();
}

export { DEFAULT_YEAR };
