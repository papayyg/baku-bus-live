import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
    root: here("."),
    plugins: [react(), tailwindcss()],
    resolve: { alias: { "@shared": here("../shared") } },
    server: {
        port: 5173,
        host: true,
        proxy: { "/api": "http://localhost:8080" },
        fs: { allow: [here("..")] },
    },
    build: {
        outDir: here("dist"),
        emptyOutDir: true,
        target: "es2022",
        assetsInlineLimit: 0,
    },
});
