import next from "eslint-config-next/core-web-vitals";
import prettier from "eslint-config-prettier";

/** @type {import('eslint').Linter.Config[]} */
const eslintConfig = [
  { ignores: [".next/**", "out/**", "build/**", "next-env.d.ts"] },
  ...next,
  // eslint-plugin-react-hooks v6 (via eslint-config-next 16) adds
  // React-Compiler-oriented rules that are stricter than this codebase.
  // Keep them visible as warnings rather than blocking.
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
    },
  },
  // `prettier` last: turns off ESLint rules that conflict with Prettier.
  prettier,
];

export default eslintConfig;
