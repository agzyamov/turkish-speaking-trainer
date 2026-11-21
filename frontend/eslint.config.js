import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "dist-*", "test-results", "node_modules", ".venv", "coverage", "android/**/build", "android/app/src/main/assets/public", "android/app/src/lab/assets"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      // C-20: the client reaches the backend only through the API client modules.
      "no-restricted-globals": ["error",
        { name: "fetch", message: "Call the backend through src/api/* (C-20)." },
        { name: "XMLHttpRequest", message: "Call the backend through src/api/* (C-20)." }],
      "no-restricted-properties": ["error",
        ...["window", "globalThis", "self"].map(object => ({ object, property: "fetch", message: "Call the backend through src/api/* (C-20)." }))],
    },
  },
  {
    // The API client, the auth client and tests may call fetch.
    files: ["src/api/**/*.ts", "src/auth.ts", "src/tests/**", "**/*.test.{ts,tsx}"],
    rules: { "no-restricted-globals": "off", "no-restricted-properties": "off" },
  },
);
