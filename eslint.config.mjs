import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import prettier from "eslint-config-prettier";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

// `prettier` last: disables ESLint rules that would conflict with Prettier.
const eslintConfig = [...compat.extends("next/core-web-vitals"), prettier];

export default eslintConfig;
