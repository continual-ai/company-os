// @ts-check

import { tanstackConfig } from "@tanstack/eslint-config"

export default [
  ...tanstackConfig,
  {
    rules: {
      "import/order": "off",
      "sort-imports": "off",
      "pnpm/json-enforce-catalog": "off",
    },
  },
  { ignores: ["eslint.config.js"] },
]
