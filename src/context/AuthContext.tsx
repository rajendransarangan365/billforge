// @ts-nocheck
import React, { createContext, useState, useEffect, useContext } from 'react';
import { Storage } from '../store/PlatformStorage';

const SESSION_KEY = 'bf_user_session';

const AuthContext = createContext({
  user: null,
  loginOwner: (_userData: any) => {},
  loginDriver: (_userData: any) => {},
  logout: () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    Storage.getItem(SESSION_KEY)
      .then(saved => { if (saved) setUser(JSON.parse(saved)); })
      .catch(() => {});
  }, []);

  const persist = async (userData: any) => {
    try { await Storage.setItem(SESSION_KEY, JSON.stringify(userData)); } catch (e) {}
  };

  const loginOwner = (userData: any) => {
    const u = { ...userData, role: userData.role || 'owner' };
    setUser(u);
    persist(u);
  };

  const loginDriver = (userData: any) => {
    const u = { ...userData, role: 'driver' };
    setUser(u);
    persist(u);
  };

  const logout = () => {
    setUser(null);
    Storage.removeItem(SESSION_KEY).catch(() => {});
  };

  return (
    <AuthContext.Provider value={{ user, loginOwner, loginDriver, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
