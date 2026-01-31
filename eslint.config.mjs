import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated artifacts
    "coverage/**",
    "web/dist/**",
    // Ignore Tauri Rust project (generated files)
    "src-tauri/**",
    // Tooling configs
    "jest.config.cjs",
    // Astro generated files
    "web/.astro/**",
  ]),
  // Custom rules
  {
    rules: {
      // Allow unused vars with _ prefix (convention for intentionally unused)
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
]);

export default eslintConfig;
