import React, { useEffect } from 'react';

const Layout: React.FC = () => {
  useEffect(() => {
    if (WebApp) {
      WebApp.ready();
      WebApp.expand();
      WebApp.enableClosingConfirmation();
      
      // Предотвращаем закрытие при свайпе
      const handleSwipe = (e: TouchEvent) => {
        if (e.touches.length > 1) {
          e.preventDefault();
        }
      };
      
      document.addEventListener('touchstart', handleSwipe, { passive: false });
      
      return () => {
        document.removeEventListener('touchstart', handleSwipe);
      };
    }
  }, []);

  return (
    // Rest of the component code
  );
};

export default Layout; 