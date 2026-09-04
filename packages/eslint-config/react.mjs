// @ts-check
import reactPlugin from 'eslint-plugin-react';
import globals from 'globals';

import base from './base.mjs';

export default [
  ...base,
  reactPlugin.configs.flat.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
    },
  },
];
