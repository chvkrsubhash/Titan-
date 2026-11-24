import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
export default defineConfig({
  plugins: [react(), tailwind()],
  optimizeDeps: {
    include: [
      "@tiptap/y-tiptap",
      "yjs",
      "y-protocols/awareness",
      "@tiptap/extension-collaboration",
      "@tiptap/extension-collaboration-caret",
      "mammoth",
    ],
  },
  server: {
    proxy: {
      "/api": {
        target: process.env.API_TARGET || "http://127.0.0.1:8000",
        ws: true,
      },
    },
  },
});
