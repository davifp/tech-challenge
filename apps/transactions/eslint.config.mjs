import config from '@tech-challenge/eslint-config/node';

export default [
  { ignores: ['src/generated/**'] },
  ...config,
  {
    files: ['src/**/*.controller.ts', 'src/**/*.module.ts'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
];
