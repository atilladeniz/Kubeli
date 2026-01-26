const nextJest = require("next/jest");

const createJestConfig = nextJest({
  dir: "./",
});

const customJestConfig = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testEnvironment: "jsdom",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^next/image$": "<rootDir>/__mocks__/next/image.tsx",
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
  },
  testPathIgnorePatterns: [
    "<rootDir>/.next/",
    "<rootDir>/out/",
    "<rootDir>/src-tauri/",
    "<rootDir>/tests/e2e/",
  ],

  // Coverage configuration
  coverageProvider: "v8", // More accurate than babel, avoids Jest 30 branch coverage bugs
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/__tests__/**",
    "!src/**/__mocks__/**",
    "!src/app/**/layout.tsx", // Async server components - test via E2E
    "!src/app/**/loading.tsx",
    "!src/app/**/error.tsx",
    "!src/app/**/not-found.tsx",
  ],
  // Coverage thresholds - increase gradually as tests are added
  // Current baseline: ~2% statements, ~13% functions, ~34% branches
  coverageThreshold: {
    global: {
      branches: 30,
      functions: 10,
      lines: 2,
      statements: 2,
    },
  },
  coverageReporters: ["text", "text-summary", "lcov", "html"],
  coverageDirectory: "coverage",
};

module.exports = createJestConfig(customJestConfig);
