import { build } from "esbuild";

const { metafile } = await build({
  entryPoints: ["widget/src/index.jsx"],
  outfile: "extensions/countdown-timer/assets/countdown-timer.js",
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2019",
  jsx: "automatic",
  jsxImportSource: "preact",
  legalComments: "none",
  metafile: true,
  logLevel: "warning",
});

// The widget has a size budget, and zod alone would use most of it.
const banned = Object.keys(metafile.inputs).filter((path) => /node_modules\/zod|shared\/validation/.test(path));
if (banned.length) {
  console.error(`The widget must not import: ${banned.join(", ")}`);
  process.exit(1);
}
console.log("Built extensions/countdown-timer/assets/countdown-timer.js");
