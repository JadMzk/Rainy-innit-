/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  clearMocks: true,
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        diagnostics: false,
        tsconfig: {
          strict: true,
          isolatedModules: true,
          esModuleInterop: true,
          types: ['jest', 'node'],
        },
      },
    ],
  },
};
