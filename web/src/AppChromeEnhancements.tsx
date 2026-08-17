import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function AppChromeEnhancements() {
  const location = useLocation();

  useEffect(() => {
    document.body.classList.toggle('gameshow-laptop-mode', location.pathname === '/gameshow');
    document.body.classList.toggle('command-centre-laptop-mode', location.pathname === '/');
    return () => {
      document.body.classList.remove('gameshow-laptop-mode');
      document.body.classList.remove('command-centre-laptop-mode');
    };
  }, [location.pathname]);

  return null;
}
