import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { storeApi } from '@/api/storeClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState(null);

  const checkUserAuth = useCallback(async () => {
    setIsLoadingAuth(true);
    try {
      const currentUser = await storeApi.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setAuthError(null);
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
      if (error.status !== 401 && error.status !== 403) {
        setAuthError({ type: 'unknown', message: error.message || 'Unable to check your session' });
      } else {
        setAuthError(null);
      }
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, []);

  const checkAppState = useCallback(async () => {
    setIsLoadingPublicSettings(true);
    setAuthError(null);
    try {
      setAppPublicSettings(await storeApi.app.getPublicSettings());
      await checkUserAuth();
    } catch (error) {
      setAuthError({ type: 'unknown', message: error.message || 'Failed to load the store' });
      setIsLoadingAuth(false);
      setAuthChecked(true);
    } finally {
      setIsLoadingPublicSettings(false);
    }
  }, [checkUserAuth]);

  useEffect(() => { checkAppState(); }, [checkAppState]);

  const logout = useCallback((shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    return storeApi.auth.logout(shouldRedirect ? '/' : undefined);
  }, []);

  const navigateToLogin = useCallback(() => {
    storeApi.auth.redirectToLogin(window.location.href);
  }, []);

  return (
    <AuthContext.Provider value={{
      user, isAuthenticated, isLoadingAuth, isLoadingPublicSettings,
      authError, appPublicSettings, authChecked, logout,
      navigateToLogin, checkUserAuth, checkAppState,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
