import config from "@tech-challenge/eslint-config/node";

export default [
  ...config,
  {
    ignores: ["apps/**", "packages/**"],
  },
];
