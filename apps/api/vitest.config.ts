import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@repo/api",
        replacement: path.resolve(__dirname, "../../packages/api/src/entry.ts"),
      },
      {
        find: /^@repo\/api\/(.*)$/,
        replacement: path.resolve(__dirname, "../../packages/api/src/$1"),
      },
    ],
  },
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["**/dist/**", "**/node_modules/**"],
  },
});
