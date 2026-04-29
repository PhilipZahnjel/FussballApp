module.exports = {
  projects: [
    // Reine TypeScript-Tests (keine React Native Imports) → Node-Umgebung
    {
      displayName: 'unit',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/__tests__/**/*.test.ts'],
      testPathIgnorePatterns: ['/node_modules/', '\\.integration\\.test\\.ts$'],
      transform: {
        '^.+\\.tsx?$': ['babel-jest', { configFile: './babel.config.js' }],
      },
      transformIgnorePatterns: [
        'node_modules/(?!(@supabase))',
      ],
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
      setupFiles: ['./jest.setup.unit.ts'],
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
    },
    // React Native / Hook-Tests → braucht jest-expo Preset
    {
      displayName: 'integration',
      preset: 'jest-expo',
      testMatch: ['<rootDir>/src/__tests__/**/*.integration.test.ts?(x)'],
      setupFiles: ['./jest.setup.ts'],
      transformIgnorePatterns: [
        'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|react-navigation|@react-navigation/.*)',
      ],
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
    },
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
  ],
};
