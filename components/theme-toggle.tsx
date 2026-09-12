'use client';

import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
  return (
    <button
      type="button"
      className="theme-toggle"
      title="Cambiar tema"
      onClick={() => {
        const dark = document.documentElement.classList.toggle('dark');
        try {
          localStorage.setItem('truco-theme', dark ? 'dark' : 'light');
        } catch {
          // Keep the selected theme for this page when storage is unavailable.
        }
      }}
    >
      <Moon aria-hidden="true" className="theme-light-icon" size={18} />
      <Sun aria-hidden="true" className="theme-dark-icon" size={18} />
      <span className="sr-only theme-light-icon">Activar modo oscuro</span>
      <span className="sr-only theme-dark-icon">Activar modo claro</span>
    </button>
  );
}
