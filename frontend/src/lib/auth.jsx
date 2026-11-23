import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, post } from './api';

const AuthContext = createContext(null);

export const isAdmin = (u) => !!u && (u.role === 'admin' || u.role === 'superadmin');
export const isSuper = (u) => !!u && u.role === 'superadmin';
export const homeFor = (u) => (isAdmin(u) ? '/admin' : '/home');

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading, null = guest
  const [config, setConfig] = useState({ app_name: 'GR Trading', google_client_id: null });

  const refresh = useCallback(async () => {
    try {
      const { user } = await api('/auth/me');
      setUser(user);
      return user;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    refresh();
    api('/config').then(setConfig).catch(() => {});
    const expired = () => setUser(null);
    const mustChange = () => setUser((u) => (u ? { ...u, must_change_password: true } : u));
    window.addEventListener('auth:expired', expired);
    window.addEventListener('auth:must-change', mustChange);
    return () => {
      window.removeEventListener('auth:expired', expired);
      window.removeEventListener('auth:must-change', mustChange);
    };
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await post('/auth/logout');
    } finally {
      setUser(null);
    }
  }, []);

  return <AuthContext.Provider value={{ user, setUser, refresh, logout, config }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
