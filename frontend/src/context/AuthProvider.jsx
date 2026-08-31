import { useState, useCallback, useEffect } from 'react';
import api from '@/api/api';
import { appParams } from '@/lib/app-params';
import { AuthContext } from '@/lib/AuthContext';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const checkAuth = useCallback(async () => {
    try {
      setIsLoadingAuth(true);
      setAuthError(null);

      if (!appParams.token) {
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
        setAuthChecked(true);
        return;
      }

      // Check current user
      const res = await api.get('/auth/me');
      setUser(res.data);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsAuthenticated(false);
      setUser(null);

      if (error.response?.status === 401) {
        setAuthError({ type: 'auth_required', message: 'Authentication required' });
      }
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, []);

  useEffect(() => {
    // Fetching auth state from the server on mount — this is a genuine
    // external-system sync (network I/O), not derived render state, so
    // useEffect is the correct tool here despite the lint's pattern match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkAuth();
  }, [checkAuth]);

  const logout = (shouldRedirect = true) => {
    localStorage.removeItem('token');
    setUser(null);
    setIsAuthenticated(false);

    if (shouldRedirect) {
      window.location.href = '/login';
    }
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      authError,
      authChecked,
      logout,
      navigateToLogin,
      checkAuth
    }}>
      {children}
    </AuthContext.Provider>
  );
};