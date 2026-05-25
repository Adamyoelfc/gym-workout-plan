import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/exercise-api": {
        target: "https://oss.exercisedb.dev",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/exercise-api/, "/api/v1/exercises"),
      },
      // Backend API in local dev (run `npm start` in ../server, or via docker).
      "/api": {
        target: process.env.VITE_API_TARGET || "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
