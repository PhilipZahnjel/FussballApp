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
    // React Native / Hook-Tests
    // Deliberately NOT using jest-expo preset because jest-expo/src/preset/setup.js
    // calls Object.defineProperty(NativeModules, ...) which crashes on Node ≥24
    // (NativeModules.default is null outside a native bridge).
    {
      displayName: 'integration',
      testEnvironment: require.resolve('react-native/jest/react-native-env.js'),
      testMatch: ['<rootDir>/src/__tests__/**/*.integration.test.ts?(x)'],
      transform: {
        '^.+\\.[jt]sx?$': ['babel-jest', { configFile: './babel.config.js' }],
      },
      transformIgnorePatterns: [
        'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|react-navigation|@react-navigation/.*|@supabase)',
      ],
      setupFiles: [
        require.resolve('react-native/jest/setup.js'),
        './jest.setup.ts',
      ],
      setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
      haste: {
        defaultPlatform: 'ios',
        platforms: ['android', 'ios', 'native'],
      },
    },
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
  ],
};
