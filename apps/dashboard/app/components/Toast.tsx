"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastMessage {
  id: string;
  title?: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, title?: string) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = useCallback(
    (message: string, type: ToastType = "info", title?: string) => {
      const id = Math.random().toString(36).substring(2, 9);
      setToast({ id, message, type, title });
    },
    []
  );

  useEffect(() => {
    if (!toast) return;
    // Errors stay up long enough to read the API's explanation
    const timer = setTimeout(() => {
      setToast(null);
    }, toast.type === "error" ? 7000 : 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Floating Center Bottom Toast Matching Prototype */}
      <div
        id="toast"
        role="status"
        aria-live="polite"
        className={toast ? "on" : ""}
      >
        {toast && (
          <span>
            {toast.title ? <strong>{toast.title}: </strong> : null}
            {toast.message}
          </span>
        )}
      </div>
    </ToastContext.Provider>
  );
}
