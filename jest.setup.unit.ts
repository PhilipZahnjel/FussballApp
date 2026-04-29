// Leichtgewichtiges Setup nur für reine TypeScript Unit-Tests
// Kein React Native, kein expo-secure-store

global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  } as Response)
);

// performance.now() ist in Node.js verfügbar, aber zur Sicherheit
if (typeof performance === 'undefined') {
  (global as any).performance = { now: () => Date.now() };
}
