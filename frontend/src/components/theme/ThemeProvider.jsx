import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

const ThemeContext = createContext(null);

const STORAGE_KEY = "eic-theme";

function getSystemTheme() {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyDomTheme(preference) {
  const resolved = preference === "system" ? getSystemTheme() : preference;
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
  return resolved;
}

function readStoredTheme(defaultTheme) {
  if (typeof window === "undefined") return defaultTheme;
  return localStorage.getItem(STORAGE_KEY) || defaultTheme;
}

/** Subscribe to OS color-scheme changes (for "system" preference). */
function subscribeSystemTheme(callback) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getSystemThemeSnapshot() {
  return getSystemTheme();
}

function getServerSnapshot() {
  return "light";
}

export function ThemeProvider({ children, defaultTheme = "system" }) {
  const [theme, setThemeState] = useState(() => readStoredTheme(defaultTheme));

  // OS preference — no setState in an effect
  const systemTheme = useSyncExternalStore(
    subscribeSystemTheme,
    getSystemThemeSnapshot,
    getServerSnapshot,
  );

  const resolvedTheme = theme === "system" ? systemTheme : theme;

  // Apply to <html> as an external system sync (DOM only — no setState)
  useEffect(() => {
    applyDomTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme, systemTheme]);

  const setTheme = useCallback((next) => {
    setThemeState(next);
    localStorage.setItem(STORAGE_KEY, next);
    applyDomTheme(next);
  }, []);

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
    }),
    [theme, resolvedTheme, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
