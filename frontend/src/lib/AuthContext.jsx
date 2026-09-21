import { createContext, useState, useContext, useEffect } from "react";
import api from "@/api/api";
import { getToken, setSession, clearSession } from "@/lib/tokenStorage";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings] = useState(null);

  // Bootstrap auth once on mount
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const token = getToken();
        if (!token) {
          if (!cancelled) {
            setUser(null);
            setIsAuthenticated(false);
            setIsLoadingAuth(false);
            setAuthChecked(true);
          }
          return;
        }

        const res = await api.get("/auth/me");
        if (cancelled) return;

        const currentUser = res.data?.user ?? res.data?.data ?? res.data;
        setUser(currentUser);
        setIsAuthenticated(true);
        setAuthError(null);
      } catch (error) {
        if (cancelled) return;

        console.error("User auth check failed:", error);
        setUser(null);
        setIsAuthenticated(false);

        if (error.response?.status === 401 || error.response?.status === 403) {
          clearSession();
          setAuthError({
            type: "auth_required",
            message: "Authentication required",
          });
        }
      } finally {
        if (!cancelled) {
          setIsLoadingAuth(false);
          setAuthChecked(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      setAuthError(null);

      const token = getToken();
      if (!token) {
        setUser(null);
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
        setAuthChecked(true);
        return;
      }

      const res = await api.get("/auth/me");
      const currentUser = res.data?.user ?? res.data?.data ?? res.data;

      setUser(currentUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    } catch (error) {
      console.error("User auth check failed:", error);
      setUser(null);
      setIsAuthenticated(false);
      setIsLoadingAuth(false);
      setAuthChecked(true);

      if (error.response?.status === 401 || error.response?.status === 403) {
        clearSession();
        setAuthError({
          type: "auth_required",
          message: "Authentication required",
        });
      }
    }
  };

  // A protected page can be restored from the browser back-forward cache
  // without remounting the app. Recheck the session before showing it.
  useEffect(() => {
    const handlePageShow = () => checkUserAuth();

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  const checkAppState = async () => {
    setIsLoadingPublicSettings(false);
    await checkUserAuth();
  };

  const login = async (email, password, remember = false) => {
    const res = await api.post("/auth/login", { email, password });

    // Support both shapes: { token, user } or { data: { token, user } }
    const token = res.data?.token ?? res.data?.data?.token;
    const loggedInUser =
      res.data?.user ?? res.data?.data?.user ?? res.data?.data;

    if (!token) {
      throw new Error(res.data?.message || "Invalid email or password");
    }

    setSession(token, loggedInUser, remember);

    setUser(loggedInUser);
    setIsAuthenticated(true);
    setAuthError(null);
    setAuthChecked(true);

    return res.data;
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    clearSession();

    if (shouldRedirect) {
      window.location.replace("/login");
    }
  };

  const navigateToLogin = () => {
    window.location.replace("/login");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authError,
        appPublicSettings,
        authChecked,
        login,
        logout,
        navigateToLogin,
        checkUserAuth,
        checkAppState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
