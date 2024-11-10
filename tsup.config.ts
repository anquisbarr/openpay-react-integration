import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["esm", "cjs"],
	dts: {
		entry: {
			index: "src/index.ts",
		},
		resolve: true,
		compilerOptions: {
			removeComments: true,
			stripInternal: true,
		},
	},
	splitting: false,
	sourcemap: false,
	clean: true,
	treeshake: {
		preset: "smallest",
	},
	external: ["react", "react-dom"],
	outDir: "dist",
	outExtension: ({ format }) => ({
		js: format === "cjs" ? ".cjs" : ".js",
	}),
	noExternal: ["zod"],
	bundle: true,
	minify: true,
	esbuildOptions(options) {
		options.ignoreAnnotations = true;
		options.drop = ["debugger", "console"];
		options.pure = ["console.log", "console.info", "console.debug", "console.warn"];
		options.legalComments = "none";
		options.minifyIdentifiers = true;
		options.minifySyntax = true;
		options.minifyWhitespace = true;
		options.treeShaking = true;
		options.keepNames = false;
	},
});
