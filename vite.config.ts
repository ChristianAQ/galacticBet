import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: process.env.BASE_PATH || "/",
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("/node_modules/@firebase/firestore/"))
              return "firebase-firestore";
            if (id.includes("/node_modules/@firebase/auth/"))
              return "firebase-auth";
            if (id.includes("/node_modules/@firebase/")) return "firebase-core";
            if (id.includes("react")) return "react-vendor";
          }
        },
      },
    },
  },
});
