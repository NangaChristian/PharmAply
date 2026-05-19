import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useDarkMode } from './DarkModeProvider';
import { useTranslation } from "react-i18next";

export function DarkModeToggle({ className = '' }: { className?: string }) {
    const { t } = useTranslation();
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  return (
    <button
      onClick={toggleDarkMode}
      className={`relative p-2 rounded-full transition-colors flex items-center justify-center ${className} ${
        isDarkMode ? 'bg-slate-800 text-yellow-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
      aria-label="Toggle Dark Mode"
      title={t('toggle_dark_mode', 'Toggle Dark Mode')}
    >
      {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
