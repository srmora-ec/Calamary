"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type NotificationType = "success" | "error" | "info" | "warning";

interface Notification {
  id: number;
  message: string;
  description?: string;
  type: NotificationType;
}

interface NotificationContextProps {
  notify: (msg: string, type?: NotificationType, desc?: string) => void;
}

const NotificationContext = createContext<NotificationContextProps | null>(null);

export const useNotification = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotification must be used within NotificationProvider");
  return ctx;
};

// --- Sub-componente para manejar la animación individual ---
const NotificationToast = ({ 
  notification, 
  removeSelf 
}: { 
  notification: Notification; 
  removeSelf: (id: number) => void; 
}) => {
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    // Iniciar temporizador para auto-cierre
    const timer = setTimeout(() => {
      handleClose();
    }, 4000); // 4 segundos visible

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    // Esperar a que termine la animación (400ms) antes de desmontar
    setTimeout(() => {
      removeSelf(notification.id);
    }, 400); 
  };

  // Iconos SVG simples según el tipo
  const icons = {
    success: <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    error:   <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    warning: <svg className="w-6 h-6 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
    info:    <svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  };

  return (
    <div
      className={`
        relative flex items-start w-80 p-4 mb-4 bg-white rounded-lg shadow-lg border border-gray-100
        transition-all duration-500 ease-in-out transform
        ${isClosing ? "opacity-0 translate-x-10" : "opacity-100 translate-x-0"}
        /* Animación de entrada inicial */
        animate-in slide-in-from-right-full fade-in duration-300
      `}
    >
      {/* Icono a la izquierda */}
      <div className="flex-shrink-0 mr-3 mt-0.5">
        {icons[notification.type]}
      </div>

      {/* Contenido */}
      <div className="flex-1 mr-2">
        <h4 className="text-sm font-semibold text-gray-900">
          {notification.message}
        </h4>
        {notification.description && (
          <p className="mt-1 text-sm text-gray-500 leading-tight">
            {notification.description}
          </p>
        )}
      </div>

      {/* Botón de cerrar (X) */}
      <button
        onClick={handleClose}
        className="flex-shrink-0 text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

// --- Provider Principal ---
export default function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const notify = (message: string, type: NotificationType = "info", description = "") => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type, description }]);
  };

  const removeNotification = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <NotificationContext.Provider value={{ notify }}>
      {children}
      
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2">
        {notifications.map(n => (
          <NotificationToast 
            key={n.id} 
            notification={n} 
            removeSelf={removeNotification} 
          />
        ))}
      </div>
    </NotificationContext.Provider>
  );
}