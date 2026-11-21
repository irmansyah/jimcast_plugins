import { defineConfig } from "tsdown";

// Core copies only dist/ and package.json into ~/.jimcast/plugins/<name>/, with
// no node_modules, so the SDK has to be bundled into the output.
// platform "node" makes tsdown emit dist/index.mjs; package.json "main" matches.
export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  platform: "node",
  target: "node20",
  outDir: "dist",
  clean: true,
  dts: false,
  deps: { alwaysBundle: [/^@jimcast\//] },
});
