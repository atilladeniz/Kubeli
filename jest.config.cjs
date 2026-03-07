const customJestConfig = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testEnvironment: "jsdom",
  transform: {
    "^.+\\.(t|j)sx?$": [
      "@swc/jest",
      {
        jsc: {
          transform: {
            react: {
              runtime: "automatic",
            },
          },
        },
      },
    ],
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^next-intl$": "<rootDir>/src/lib/i18n/next-intl-compat.ts",
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  testPathIgnorePatterns: [
    "<rootDir>/dist/",
    "<rootDir>/src-tauri/",
    "<rootDir>/tests/e2e/",
  ],

  // Coverage configuration
  coverageProvider: "v8",
  collectCoverageFrom: [
    "src/lib/**/*.{ts,tsx}",
    "src/components/features/**/hooks/**/*.{ts,tsx}",
    "src/components/features/**/utils/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/__tests__/**",
    "!src/**/__mocks__/**",
    "!src/**/index.ts",
    "!src/main.tsx",
    "!src/lib/types/kubernetes.ts",
    "!src/lib/workers/**",
    "!src/lib/stores/ai-store/types.ts",
    "!src/lib/hooks/k8s/index.ts",
    "!src/lib/hooks/k8s/types.ts",
  ],
  coverageThreshold: {
    global: {
      branches: 35,
      functions: 40,
      lines: 30,
      statements: 30,
    },
    "./src/lib/tauri/commands/": {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    "./src/lib/templates/": {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    "./src/components/features/ai/utils/": {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    "./src/lib/stores/ai-store/actions/": {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    "./src/lib/stores/ai-store/helpers.ts": {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    "./src/lib/types/errors.ts": {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
  coverageReporters: ["text", "text-summary", "lcov", "html"],
  coverageDirectory: "coverage",
};

module.exports = customJestConfig;
