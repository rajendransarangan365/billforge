// @ts-nocheck
import React, { createContext, useState, useEffect, useContext } from 'react';
import { Storage } from '../store/PlatformStorage';

const SESSION_KEY = 'bf_user_session';

const AuthContext = createContext({
  user: null,
  quarryId: null,
  role: null, // 'admin' | 'quarry_owner' | 'driver' | 'customer'
  isAdmin: false,
  isOwner: false,
  isDriver: false,
  isCustomer: false,
  loginAdmin: (_userData: any) => {},
  loginOwner: (_userData: any) => {},
  loginDriver: (_userData: any) => {},
  loginCustomer: (_userData: any) => {},
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

  const loginAdmin = (userData: any) => {
    const u = { ...userData, role: 'admin' };
    setUser(u);
    persist(u);
  };

  const loginOwner = (userData: any) => {
    const u = {
      ...userData,
      quarry_id: userData.quarry_id || userData.id || 1,
      role: 'quarry_owner',
    };
    setUser(u);
    persist(u);
  };

  const loginDriver = (userData: any) => {
    const u = { ...userData, role: 'driver' };
    setUser(u);
    persist(u);
  };

  const loginCustomer = (userData: any) => {
    const u = { ...userData, role: 'customer' };
    setUser(u);
    persist(u);
  };

  const logout = () => {
    setUser(null);
    Storage.removeItem(SESSION_KEY).catch(() => {});
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem('bf_user_session');
        localStorage.removeItem('bf_user_role');
        localStorage.removeItem('bf_active_user');
      } catch (e) {}
    }
  };


  const role = user?.role || null;
  const quarryId = user?.quarry_id || null;

  return (
    <AuthContext.Provider value={{
      user, quarryId, role,
      isAdmin: role === 'admin',
      isOwner: role === 'quarry_owner',
      isDriver: role === 'driver',
      isCustomer: role === 'customer',
      loginAdmin, loginOwner, loginDriver, loginCustomer, logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
