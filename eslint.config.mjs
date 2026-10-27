import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Allow `const { secret: _, ...safe } = obj` to strip fields before returning them.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { ignoreRestSiblings: true, varsIgnorePattern: '^_', argsIgnorePattern: '^_' },
      ],
      eqeqeq: 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      curly: ['error', 'multi-line'],
      'no-console': ['error', { allow: ['warn', 'error', 'info'] }],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'coverage/**',
    'next-env.d.ts',
  ]),
]);

export default eslintConfig;
