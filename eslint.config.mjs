import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

const prohibitedMessage = "Prohibited by user instruction";

export default defineConfig([
  // 生成物と、shadcn/ui の CLI で追加した部品は対象にしません。
  globalIgnores(["**/.next/", "**/.amplify/", "**/dist/", "**/dev-dist/", "tmp/", "packages/ui/src/components/", "packages/ui/src/hooks/", "**/next-env.d.ts"]),

  js.configs.recommended,

  // Next のアプリと共通の画面の部品に、Next と React Hooks の推奨のルールを当てます。
  {
    files: ["apps/**/*.{ts,tsx}", "packages/ui/src/**/*.{ts,tsx}"],
    extends: [nextPlugin.configs["core-web-vitals"], reactHooks.configs.flat.recommended],
    settings: { next: { rootDir: "apps/*/" } }
  },

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
