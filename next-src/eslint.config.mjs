import { defineConfig, globalIgnores } from 'eslint/config';
import nextPlugin from '@next/eslint-plugin-next';
import jsxA11y from 'eslint-plugin-jsx-a11y-x';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default defineConfig([
  tseslint.configs.base,
  tseslint.configs.eslintRecommended,
  nextPlugin.configs['core-web-vitals'],
  reactHooks.configs.flat.recommended,
  jsxA11y.configs.recommended,
  {
    rules: {
      indent: 'off',
      'react/no-unescaped-entities': 'off',
      '@next/next/no-page-custom-font': 'off',
      'no-console': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
    },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
]);
