import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			"@": resolve(__dirname, "src"),
		},
	},
	root: "src/dev",
	build: {
		outDir: resolve(__dirname, "dist-dev"),
		emptyOutDir: true,
	},
});