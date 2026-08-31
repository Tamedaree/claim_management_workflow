// Centralized session storage.
//
// Default: sessionStorage — cleared when the tab/browser closes.
// "Remember me" checked at login: localStorage — persists across restarts.
//
// Every other file should go through these helpers instead of touching
// localStorage/sessionStorage directly, so there's one source of truth
// for where the session actually lives.

const TOKEN_KEY = "token";
const USER_KEY = "user";

export function setSession(token, user, remember = false) {
  // Clear both stores first so a stale copy never lingers in the
  // non-active storage (e.g. switching from "remember me" on to off).
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);

  const store = remember ? localStorage : sessionStorage;
  if (token) store.setItem(TOKEN_KEY, token);
  if (user) store.setItem(USER_KEY, JSON.stringify(user));
}

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
}

export function getUser() {
  const raw =
    sessionStorage.getItem(USER_KEY) || localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Merges partial fields into whichever storage currently holds the
// session (session or local), preserving the user's "remember me" choice.
export function updateStoredUser(partialUser) {
  const activeStore = sessionStorage.getItem(TOKEN_KEY)
    ? sessionStorage
    : localStorage.getItem(TOKEN_KEY)
      ? localStorage
      : null;

  if (!activeStore) return;

  const existing = getUser() || {};
  const merged = { ...existing, ...partialUser };
  activeStore.setItem(USER_KEY, JSON.stringify(merged));
}

export function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
