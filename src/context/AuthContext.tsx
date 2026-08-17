// @ts-nocheck
import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
    // Load stored session on startup
    AsyncStorage.getItem(SESSION_KEY)
      .then(saved => {
        if (saved) setUser(JSON.parse(saved));
      })
      .catch(() => {});
  }, []);

  const persist = async (userData) => {
    try {
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(userData));
    } catch (e) {}
  };

  const loginOwner = (userData) => {
    const u = { ...userData, role: userData.role || 'owner' };
    setUser(u);
    persist(u);
  };

  const loginDriver = (userData) => {
    const u = { ...userData, role: 'driver' };
    setUser(u);
    persist(u);
  };

  const logout = () => {
    setUser(null);
    AsyncStorage.removeItem(SESSION_KEY).catch(() => {});
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
