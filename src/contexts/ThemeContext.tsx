import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { Colors, lightColors, darkColors } from '../constants/colors';

const STORAGE_KEY = 'pk_theme';

// Same platform-aware storage as supabase.ts
const themeStorage = {
  get: async (): Promise<string | null> => {
    if (Platform.OS === 'web') {
      if (typeof document === 'undefined') return null;
      const match = document.cookie.match(
        new RegExp('(?:^|; )' + STORAGE_KEY + '=([^;]*)')
      );
      return match ? decodeURIComponent(match[1]) : null;
    } else {
      const SecureStore = await import('expo-secure-store');
      return SecureStore.getItemAsync(STORAGE_KEY);
    }
  },
  set: async (value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      if (typeof document === 'undefined') return;
      const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
      const secure = isHttps ? '; Secure' : '';
      // 1 Jahr Gültigkeit
      document.cookie = `${STORAGE_KEY}=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Strict${secure}`;
    } else {
      const SecureStore = await import('expo-secure-store');
      SecureStore.setItemAsync(STORAGE_KEY, value);
    }
  },
};

type ThemeContextValue = {
  C: Colors;
  isDark: boolean;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  C: lightColors,
  isDark: false,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    themeStorage.get().then(val => {
      if (val === 'dark') setIsDark(true);
    });
  }, []);

  const toggleTheme = () => {
    setIsDark(prev => {
      const next = !prev;
      themeStorage.set(next ? 'dark' : 'light');
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ C: isDark ? darkColors : lightColors, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
