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
      const preventSwipe = (e: TouchEvent) => {
        const touchY = e.touches[0].clientY;
        if (touchY < 100) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      };

      // Добавляем обработчики событий
      document.addEventListener('touchstart', preventSwipe, { passive: false });
      document.addEventListener('touchmove', preventSwipe, { passive: false });
      
      // Добавляем CSS для предотвращения свайпа
      const style = document.createElement('style');
      style.textContent = `
        body {
          position: fixed;
          width: 100%;
          height: 100%;
          overflow: auto;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-y: contain;
        }
        
        #__next {
          height: 100%;
          overflow: auto;
          -webkit-overflow-scrolling: touch;
        }
        
        * {
          overscroll-behavior-y: contain;
          touch-action: pan-x pan-y;
        }
      `;
      document.head.appendChild(style);
      
      return () => {
        document.removeEventListener('touchstart', preventSwipe);
        document.removeEventListener('touchmove', preventSwipe);
        document.head.removeChild(style);
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