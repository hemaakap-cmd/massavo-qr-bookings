import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    // dist/ is build output. supabase/functions run on Deno with `npm:` imports
    // and Deno globals, so the browser/node configs below do not apply to them.
    // previewAuthStorage.ts is machine-generated and re-emitted on every sync
    // ("Do not edit it directly"), so hand-fixing its lint findings does not
    // survive. It is excluded rather than repeatedly re-patched.
    ignores: [
      "dist",
      "node_modules",
      "supabase/functions",
      "src/components/ui",
      "src/integrations/supabase/previewAuthStorage.ts",
    ],
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      // The codebase compiles with `strict: false` / `noImplicitAny: false`, so
      // these two would fire in the hundreds without indicating real defects.
      // Left off until the tsconfig is tightened.
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    // Config + tooling files run on Node, not in the browser.
    files: ["*.config.{js,ts}", "scripts/**/*.ts"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // Tailwind resolves its plugins through CommonJS `require()`. That is the
    // documented way to register them, so the rule is relaxed for this one file
    // rather than reworking the Tailwind config.
    files: ["tailwind.config.ts"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
);
