import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const baseFromEnv = process.env.BASE_URL || "/";
const normalizedBase = baseFromEnv.endsWith("/")
  ? baseFromEnv
  : `${baseFromEnv}/`;

export default defineConfig({
  plugins: [react()],
  base: normalizedBase,
});
