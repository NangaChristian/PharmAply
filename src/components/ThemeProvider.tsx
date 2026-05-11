import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface ThemeSettings {
  primaryColor: string;
  logoUrl: string;
  dashboardWelcomeText: string;
  dashboardSubtitleText: string;
}

const defaultTheme: ThemeSettings = {
  primaryColor: '#4f46e5', // indigo-600
  logoUrl: '',
  dashboardWelcomeText: 'Welcome to our application',
  dashboardSubtitleText: "Here's what is happening today."
};

const ThemeContext = createContext<ThemeSettings>(defaultTheme);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeSettings>(defaultTheme);

  useEffect(() => {
    const fetchTheme = async () => {
      try {
        const docRef = doc(db, 'settings', 'theme');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setTheme({ ...defaultTheme, ...docSnap.data() });
        }
      } catch (error) {
        console.error('Failed to fetch theme', error);
      }
    };
    fetchTheme();
  }, []);

  useEffect(() => {
    // Inject dynamic styles to override tailwind indigo variables as primary app color
    const styleId = 'dynamic-theme-styles';
    let styleEl = document.getElementById(styleId) as HTMLStyleElement;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    styleEl.innerHTML = `
      :root {
        --app-primary-color: ${theme.primaryColor};
        /* Override commonly used standard colors to apply the primary brand color globally */
        --color-indigo-600: var(--app-primary-color);
        --color-indigo-500: var(--app-primary-color);
      }
      .bg-indigo-600 { background-color: var(--app-primary-color) !important; }
      .text-indigo-600 { color: var(--app-primary-color) !important; }
      .border-indigo-600 { border-color: var(--app-primary-color) !important; }
      .fill-indigo-600 { fill: var(--app-primary-color) !important; }
      .from-indigo-600 { --tw-gradient-from: var(--app-primary-color) !important; }
      .ring-indigo-600 { --tw-ring-color: var(--app-primary-color) !important; }
    `;
  }, [theme.primaryColor]);

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
