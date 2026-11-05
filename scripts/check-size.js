import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const FAIL_KB = 30;
const TARGET_KB = 15;
const ADVISORY_KB = 10;

const js = readFileSync("extensions/countdown-timer/assets/countdown-timer.js");
const liquid = readFileSync("extensions/countdown-timer/blocks/countdown-timer.liquid", "utf8");
const css = liquid.match(/<style>([\s\S]*?)<\/style>/)?.[1];
if (!css) {
  console.error("check:size couldn't find the block's <style>, so the CSS wasn't measured.");
  process.exit(1);
}

const kb = (bytes) => bytes / 1024;
const jsKb = kb(gzipSync(js).length);
const totalKb = kb(gzipSync(Buffer.concat([js, Buffer.from(css)])).length);

console.log(`Widget JS: ${jsKb.toFixed(2)}KB gzipped (Shopify's advisory is ${ADVISORY_KB}KB)`);
console.log(`Widget JS + CSS: ${totalKb.toFixed(2)}KB gzipped (target ${TARGET_KB}KB, fails above ${FAIL_KB}KB)`);
if (jsKb > ADVISORY_KB) console.log(`Advisory: JS is above ${ADVISORY_KB}KB.`);
if (totalKb > TARGET_KB) console.log(`Warning: above the ${TARGET_KB}KB target.`);
if (totalKb > FAIL_KB) {
  console.error(`Failed: above the ${FAIL_KB}KB limit.`);
  process.exit(1);
}
