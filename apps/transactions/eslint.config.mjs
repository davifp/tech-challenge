import config from '@tech-challenge/eslint-config/node';

export default [
  { ignores: ['src/generated/**'] },
  ...config,
  {
    files: [
      'src/**/*.controller.ts',
      'src/**/*.module.ts',
      'src/**/*.service.ts',
      'src/**/*.repository.ts',
      'src/**/*.filter.ts',
      'src/**/*.guard.ts',
      'src/**/*.interceptor.ts',
      'src/**/*.middleware.ts',
    ],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
];
