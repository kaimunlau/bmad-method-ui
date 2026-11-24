import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // eslint-plugin-react-hooks 7.1 (via eslint-config-next 16.4) made
  // set-state-in-effect an error. These two pre-existing sites still need a
  // refactor; keep them visible as warnings until then.
  {
    files: [
      "src/app/(dashboard)/profile/page.tsx",
      "src/components/ui/sidebar.tsx",
    ],
    rules: { "react-hooks/set-state-in-effect": "warn" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Third-party vendored components
    "src/components/animate-ui/**",
    "src/components/reui/**",
  ]),
]);

export default eslintConfig;
