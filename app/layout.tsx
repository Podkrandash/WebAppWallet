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
      
      // Более агрессивное предотвращение закрытия при свайпе
      const preventClose = (e: TouchEvent) => {
        if (e.touches.length > 0) {
          const touch = e.touches[0];
          const startY = touch.clientY;
          
          if (startY < 100) { // Если свайп начинается в верхней части экрана
            e.preventDefault();
            e.stopPropagation();
          }
        }
        return false;
      };

      // Добавляем обработчики с capture phase
      document.addEventListener('touchstart', preventClose, { passive: false, capture: true });
      document.addEventListener('touchmove', preventClose, { passive: false, capture: true });
      document.addEventListener('touchend', preventClose, { passive: false, capture: true });
      
      // Блокируем скролл на всех уровнях
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
      document.body.style.overscrollBehavior = 'none';
      document.documentElement.style.position = 'fixed';
      document.documentElement.style.width = '100%';
      document.documentElement.style.height = '100%';
      document.documentElement.style.overscrollBehavior = 'none';
      
      return () => {
        document.removeEventListener('touchstart', preventClose, { capture: true });
        document.removeEventListener('touchmove', preventClose, { capture: true });
        document.removeEventListener('touchend', preventClose, { capture: true });
      };
    }
  }, []);

  return (
    <html lang="ru" style={{ 
      overscrollBehavior: 'none',
      position: 'fixed',
      width: '100%',
      height: '100%',
      overflow: 'hidden'
    }}>
      <body style={{ 
        overscrollBehavior: 'none',
        position: 'fixed',
        width: '100%',
        height: '100%',
        overflow: 'hidden'
      }}>
        {children}
      </body>
    </html>
  );
} 