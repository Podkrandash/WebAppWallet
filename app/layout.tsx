import React, { useEffect } from 'react';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        ready: () => void;
        expand: () => void;
        showAlert: (message: string) => void;
        close: () => void;
        enableClosingConfirmation: () => void;
        setHeaderColor: (color: string) => void;
        setBackgroundColor: (color: string) => void;
        BackButton: {
          onClick: (callback: () => void) => void;
          hide: () => void;
          show: () => void;
        };
      };
    };
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const WebApp = window.Telegram.WebApp;
      WebApp.ready();
      WebApp.expand();
      WebApp.enableClosingConfirmation();
      
      // Предотвращаем закрытие при свайпе
      const preventClose = (e: Event) => {
        e.preventDefault();
        return false;
      };
      
      // Добавляем обработчики для всех событий свайпа
      document.addEventListener('touchstart', preventClose, { passive: false });
      document.addEventListener('touchmove', preventClose, { passive: false });
      document.addEventListener('touchend', preventClose, { passive: false });
      document.body.style.overscrollBehavior = 'none';
      document.documentElement.style.overscrollBehavior = 'none';
      
      return () => {
        document.removeEventListener('touchstart', preventClose);
        document.removeEventListener('touchmove', preventClose);
        document.removeEventListener('touchend', preventClose);
      };
    }
  }, []);

  return (
    <html lang="ru" style={{ overscrollBehavior: 'none' }}>
      <body style={{ 
        overscrollBehavior: 'none',
        overflow: 'hidden'
      }}>
        {children}
      </body>
    </html>
  );
} 