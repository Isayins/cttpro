/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Node 内置模块要用 node: 前缀
import path from "node:path";
import { fileURLToPath } from "node:url";

// __dirname 在 ESM 里要自己算
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // 这里不放 storybookTest，保证能 build
  test: {
    // 仅 Vitest 配置，不包含 storybook
  },
});
