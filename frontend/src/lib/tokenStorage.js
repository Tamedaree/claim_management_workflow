const TOKEN_KEY = "token";
const USER_KEY = "user";

export function setSession(token, user, remember = false) {
  // Always one shared session for the whole browser
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);

  if (token) localStorage.setItem(TOKEN_KEY, token);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));

  // Optional: only "remember" changes expiry on the server later;
  // for now both paths use localStorage so tabs share one login.
  if (!remember) {
    // optional flag if you want UI to know
    localStorage.setItem("remember_me", "0");
  } else {
    localStorage.setItem("remember_me", "1");
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function updateStoredUser(partialUser) {
  const existing = getUser() || {};
  localStorage.setItem(
    USER_KEY,
    JSON.stringify({ ...existing, ...partialUser }),
  );
}

export function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem("remember_me");
}
