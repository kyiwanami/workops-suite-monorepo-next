import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

const prohibitedMessage = "Prohibited by user instruction";

export default defineConfig([
  js.configs.recommended,

  {
    files: ["**/*.{ts,tsx}"],

    extends: [tseslint.configs.recommended],

    languageOptions: {
      parserOptions: {
        projectService: true
      }
    },

    rules: {
      "@typescript-eslint/no-explicit-any": "error",

      "@typescript-eslint/no-non-null-assertion": "error",

      "@typescript-eslint/no-restricted-types": [
        "error",
        {
          types: {
            Omit: prohibitedMessage,
            Pick: prohibitedMessage,
            Partial: prohibitedMessage,
            unknown: prohibitedMessage
          }
        }
      ],

      "@typescript-eslint/consistent-type-assertions": [
        "error",
        {
          assertionStyle: "never"
        }
      ],

      "no-restricted-globals": [
        "error",
        {
          name: "setTimeout",
          message: prohibitedMessage
        },
        {
          name: "setInterval",
          message: prohibitedMessage
        }
      ],

      "no-restricted-properties": [
        "error",
        {
          property: "trim",
          message: prohibitedMessage
        }
      ],

      "@typescript-eslint/no-unnecessary-condition": "error"
    }
  }
]);
