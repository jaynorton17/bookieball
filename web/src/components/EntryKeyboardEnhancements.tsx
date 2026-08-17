import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

function findManualPanel(): HTMLElement | null {
  const heading = Array.from(document.querySelectorAll<HTMLElement>('h3')).find((element) => element.textContent?.trim() === 'Manual Add Entry');
  return heading?.closest<HTMLElement>('.panel') ?? null;
}

function enabledInputs(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>('input:not([disabled]), select:not([disabled])'))
    .filter((element) => !element.matches('input[type="checkbox"]'));
}

export function EntryKeyboardEnhancements() {
  const location = useLocation();

  useEffect(() => {
    if (location.pathname !== '/entries') return undefined;
    let panel: HTMLElement | null = null;
    let cleanupPanel: (() => void) | null = null;
    let observer: MutationObserver | null = null;

    const attach = () => {
      if (panel?.isConnected) return;
      cleanupPanel?.();
      panel = findManualPanel();
      if (!panel) return;

      observer?.disconnect();
      panel.classList.add('entry-keyboard-ready');
      const teamSelect = panel.querySelector<HTMLSelectElement>('select');
      window.setTimeout(() => teamSelect?.focus(), 80);

      const onKeyDown = (event: KeyboardEvent) => {
        const target = event.target;
        if (!(target instanceof HTMLElement) || !panel?.contains(target)) return;
        const save = Array.from(panel.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.trim() === 'Save Entry');
        if (!save || save.disabled) return;

        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          save.click();
          return;
        }

        if (event.key !== 'Enter' || target instanceof HTMLSelectElement) return;
        if (!(target instanceof HTMLInputElement) || target.type === 'checkbox') return;

        event.preventDefault();
        const fields = enabledInputs(panel);
        const index = fields.indexOf(target);
        const next = fields.slice(index + 1)[0];
        if (next) {
          next.focus();
          if (next instanceof HTMLInputElement && next.type === 'number') next.select();
        } else {
          save.click();
        }
      };

      panel.addEventListener('keydown', onKeyDown);
      cleanupPanel = () => {
        panel?.removeEventListener('keydown', onKeyDown);
        panel?.classList.remove('entry-keyboard-ready');
      };
    };

    attach();
    if (!panel) {
      observer = new MutationObserver(attach);
      observer.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      observer?.disconnect();
      cleanupPanel?.();
    };
  }, [location.pathname]);

  return null;
}
