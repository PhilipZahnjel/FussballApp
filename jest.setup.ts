// NOTE: @testing-library/jest-native/extend-expect must be in setupFilesAfterEnv
// (needs expect to exist). It is added there in jest.config.js for the integration project.

// Expo SecureStore Mock (nicht verfügbar in Jest)
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

// React Native URL Polyfill
jest.mock('react-native-url-polyfill/auto', () => {});

// Supabase Client Mock
jest.mock('./src/lib/supabase', () => {
  const realtimeChannel = {
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn().mockReturnThis(),
    unsubscribe: jest.fn(),
  };

  return {
    supabase: {
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        gt: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        then: jest.fn((cb: (v: any) => any) => Promise.resolve(cb({ data: [], error: null }))),
      })),
      auth: {
        getUser: jest.fn(() => Promise.resolve({ data: { user: null }, error: null })),
        signInWithPassword: jest.fn(() => Promise.resolve({ data: null, error: null })),
        signOut: jest.fn(() => Promise.resolve({ error: null })),
        onAuthStateChange: jest.fn((_event: string, _cb: (event: string, session: any) => void) => ({
          data: { subscription: { unsubscribe: jest.fn() } },
        })),
      },
      channel: jest.fn(() => realtimeChannel),
      removeChannel: jest.fn(() => Promise.resolve()),
      functions: {
        invoke: jest.fn(() => Promise.resolve({ data: null, error: null })),
      },
    },
  };
});

// Globale Fetch-Mock
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  } as Response)
);
