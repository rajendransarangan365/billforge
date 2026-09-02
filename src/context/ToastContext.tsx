// @ts-nocheck
import React, { createContext, useContext, useState, useCallback } from 'react';
import { ToastContainer, ToastMessage } from '../components/Toast';

interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning', title?: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success', title?: string, duration = 3500) => {
      const id = Date.now().toString() + Math.random().toString().slice(2, 6);
      const newToast: ToastMessage = { id, message, type, title, duration };
      
      setToasts((prev) => [...prev.slice(-4), newToast]); // Keep max 5 active toasts in stack
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
