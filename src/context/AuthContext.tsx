// @ts-nocheck
import React, { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext({
  user: null,
  loginOwner: () => {},
  loginDriver: () => {},
  logout: () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Load stored session on startup
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem('billforge_user_session');
        if (saved) {
          setUser(JSON.parse(saved));
        }
      } catch (e) {}
    }
  }, []);

  const loginOwner = (userData) => {
    const ownerUser = { ...userData, role: 'owner' };
    setUser(ownerUser);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('billforge_user_session', JSON.stringify(ownerUser));
    }
  };

  const loginDriver = (userData) => {
    const driverUser = { ...userData, role: 'driver' };
    setUser(driverUser);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('billforge_user_session', JSON.stringify(driverUser));
    }
  };

  const logout = () => {
    setUser(null);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('billforge_user_session');
    }
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
