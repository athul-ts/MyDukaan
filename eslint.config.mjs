import js from "@eslint/js";
import globals from "globals";

const noUnsafeHtml = {
  selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
  message: "Merchant text must render as text nodes. See specs/05-widget.md.",
};

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      ".shopify/**",
      "extensions/*/assets/**",
      // The template's webhook stubs stay as shipped (specs/04-api.md).
      "web/privacy.js",
    ],
  },
  js.configs.recommended,
  {
    files: ["web/**/*.js", "shared/**/*.js", "scripts/**/*.js", "*.mjs"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["web/frontend/**/*.{js,jsx}", "widget/**/*.{js,jsx}"],
    languageOptions: {
      globals: { ...globals.browser, shopify: "readonly" },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Components are only referenced from JSX, which this rule can't see without a React plugin.
      "no-unused-vars": ["error", { varsIgnorePattern: "^[A-Z]" }],
      "no-restricted-syntax": ["error", noUnsafeHtml],
    },
  },
  {
    files: ["web/frontend/vite.config.js"],
    languageOptions: { globals: globals.node },
  },
];
