// @ts-nocheck
import React, { createContext, useState, useEffect, useContext } from 'react';
import { Storage } from '../store/PlatformStorage';

const SESSION_KEY = 'bf_user_session';

const AuthContext = createContext({
  user: null,
  companyId: 1,
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
    const u = {
      ...userData,
      company_id: userData.company_id || userData.id || 1,
      role: userData.role || 'owner',
    };
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

  const companyId = user?.company_id || user?.id || 1;

  return (
    <AuthContext.Provider value={{ user, companyId, loginOwner, loginDriver, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

