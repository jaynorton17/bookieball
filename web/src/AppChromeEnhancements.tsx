import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from './lib/api';

export function AppChromeEnhancements() {
  const location = useLocation();
  const [penaltyCount, setPenaltyCount] = useState(0);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const queue = await api.penaltyQueue();
        if (active) setPenaltyCount(queue.length);
      } catch {
        if (active) setPenaltyCount(0);
      }
    };

    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle('gameshow-laptop-mode', location.pathname === '/gameshow');
    return () => document.body.classList.remove('gameshow-laptop-mode');
  }, [location.pathname]);

  useEffect(() => {
    const nav = document.querySelector('.topbar-nav');
    if (!nav) return;

    let link = nav.querySelector<HTMLAnchorElement>('a[data-penalties-nav="true"]');
    if (!link) {
      link = document.createElement('a');
      link.href = '/penalty-shootout';
      link.dataset.penaltiesNav = 'true';
      link.className = 'topbar-nav-link penalties-nav-link';
      link.addEventListener('click', (event) => {
        event.preventDefault();
        window.history.pushState({}, '', '/penalty-shootout');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });
      nav.appendChild(link);
    }

    link.textContent = penaltyCount > 0 ? `Penalties (${penaltyCount})` : 'Penalties';
    link.classList.toggle('active', location.pathname === '/penalty-shootout');
    link.classList.toggle('penalties-live', penaltyCount > 0);
  }, [location.pathname, penaltyCount]);

  return null;
}
