import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase-Konfiguration fehlt. Prüfe ob die .env Datei ' +
    'EXPO_PUBLIC_SUPABASE_URL und EXPO_PUBLIC_SUPABASE_ANON_KEY enthält.'
  );
}

// Cookie-Storage für Web:
// - SameSite=Strict: verhindert CSRF (Cookie wird nicht bei Anfragen von fremden Seiten mitgeschickt)
// - Secure: Cookie nur über HTTPS (wirkt sobald HTTPS aktiv ist)
// - max-age=86400: 24 Stunden Gültigkeit, danach neuer Login erforderlich
// Hinweis: httpOnly ist ohne Server-Endpunkt nicht setzbar — das wäre der nächste Schritt
//          wenn später ein serverseitiges Login-Handling eingebaut wird.
const cookieStorage = {
  getItem: (key: string): Promise<string | null> => {
    if (typeof document === 'undefined') return Promise.resolve(null);
    const match = document.cookie.match(
      new RegExp('(?:^|; )' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)')
    );
    return Promise.resolve(match ? decodeURIComponent(match[1]) : null);
  },
  setItem: (key: string, value: string): Promise<void> => {
    if (typeof document === 'undefined') return Promise.resolve();
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const secure = isHttps ? '; Secure' : '';
    document.cookie = `${key}=${encodeURIComponent(value)}; path=/; max-age=28800; SameSite=Strict${secure}`;
    return Promise.resolve();
  },
  removeItem: (key: string): Promise<void> => {
    if (typeof document === 'undefined') return Promise.resolve();
    document.cookie = `${key}=; path=/; max-age=0; SameSite=Strict`;
    return Promise.resolve();
  },
};

// Auf Native (iOS/Android): expo-secure-store → verschlüsselter Keychain/Keystore
// Auf Web: Cookie mit SameSite=Strict + Secure (bei HTTPS)
const storage = Platform.OS === 'web' ? cookieStorage : {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(supabaseUrl!, supabaseAnonKey!, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
