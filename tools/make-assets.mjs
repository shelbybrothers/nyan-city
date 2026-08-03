// Cut every brand asset out of the one source image: ~/experimental/nyan.png.
//
// Run it whenever that source changes:
//   NODE_PATH="<any project with sharp>/node_modules" node tools/make-assets.mjs
// (sharp is deliberately not a dependency of the web app — this is a build-time
// tool, not something the site ships.)
//
// Produces, all with the navy knocked out to transparency so they composite on
// any background:
//   web/public/nyan-logo.png     full art — rainbow + cat, used as the wordmark lockup
//   web/public/assets/cat.png    the cat alone — the in-game sprite
//   web/public/favicon.png       square icon
//   web/public/apple-touch-icon.png
//   web/public/nyan-og.png       is rendered separately (see tools/render-og.sh)

import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.join(HERE, "..", "web", "public");
const SRC = process.env.NYAN_SRC || "/Users/medikamedika/experimental/nyan.png";

// Sampled from the source, not guessed. See lib/brand.js for the same values.
const NAVY = [1, 53, 104];
const RAINBOW = [
  [251, 2, 1], // red
  [253, 149, 2], // orange
  [253, 251, 5], // yellow
  [44, 250, 4], // green
  [0, 150, 253], // blue
  [99, 49, 253], // purple
];

const near = (r, g, b, [tr, tg, tb], tol) =>
  Math.abs(r - tr) <= tol && Math.abs(g - tg) <= tol && Math.abs(b - tb) <= tol;

const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;
const C = 4;

// Knock the navy out. Hard alpha, no feathering — this is pixel art and a soft
// edge would show as a navy halo on a different background.
const rgba = Buffer.from(data);
for (let i = 0; i < W * H; i++) {
  const o = i * C;
  if (near(rgba[o], rgba[o + 1], rgba[o + 2], NAVY, 26)) rgba[o + 3] = 0;
}

const opaqueAt = (x, y) => rgba[(y * W + x) * C + 3] !== 0;

// Where does the cat's body start? Colour alone will not answer it — the tail
// crosses the rainbow, and bright green anti-aliasing reads as rainbow-yellow.
// The pop-tart's left border is the giveaway: a single column of black hundreds
// of pixels tall, which nothing in the trail has. Take the first such column.
const inkAt = (o) => rgba[o + 3] !== 0 && rgba[o] < 40 && rgba[o + 1] < 40 && rgba[o + 2] < 40;

/**
 * Outline, not noise. The source has a few stray dark pixels floating in the
 * navy; one of them sat 100px below the cat and dragged the crop box down with
 * it. Real outline is 8px thick at this scale, so demanding a solid
 * neighbourhood keeps every genuine edge and drops the specks.
 */
const isInk = (o) => {
  if (!inkAt(o)) return false;
  const i = o / C;
  const x = i % W;
  const y = (i - x) / W;
  if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) return false;
  let n = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      if (inkAt(((y + dy) * W + (x + dx)) * C)) n++;
    }
  }
  return n >= 5;
};

let bodyLeft = 0;
{
  const tall = Math.floor(H * 0.25);
  for (let x = 0; x < W && !bodyLeft; x++) {
    let run = 0;
    for (let y = 0; y < H; y++) if (isInk((y * W + x) * C)) run++;
    if (run >= tall) bodyLeft = x;
  }
}

function bbox(minX = 0, test = opaqueAt) {
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = minX; x < W; x++) {
      if (!test(x, y)) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

const artBox = bbox(0);

// The cat is bounded by its own black outline. Going by opacity instead would
// swallow the free-floating white star that sits below it.
const catBox = bbox(bodyLeft, (x, y) => isInk((y * W + x) * C));

console.log("source", W + "×" + H, "| cat body starts at x=" + bodyLeft);
console.log("art  ", artBox);
console.log("cat  ", catBox);

const cut = (box, buf = rgba) =>
  sharp(buf, { raw: { width: W, height: H, channels: 4 } }).extract(box);

// The star sits directly under the cat's feet and its top row lands inside the
// outline's bottom row, so the box alone cannot separate them. Below the lowest
// ink in each column there is nothing of the cat left — erase it.
const catOnly = Buffer.from(rgba);
for (let x = catBox.left; x < catBox.left + catBox.width; x++) {
  let lastInk = -1;
  for (let y = 0; y < H; y++) if (isInk((y * W + x) * C)) lastInk = y;
  for (let y = lastInk + 1; y < H; y++) catOnly[(y * W + x) * C + 3] = 0;
}

mkdirSync(path.join(PUB, "assets"), { recursive: true });

// Full lockup, capped at 1200px wide so the landing page is not shipping a 1.2MB hero.
await cut(artBox)
  .resize({ width: Math.min(artBox.width, 1200), kernel: "nearest" })
  .png({ compressionLevel: 9 })
  .toFile(path.join(PUB, "nyan-logo.png"));

// The in-game sprite. Nearest-neighbour: this is pixel art, it must not blur.
await cut(catBox, catOnly)
  .resize({ width: 640, kernel: "nearest" })
  .png({ compressionLevel: 9 })
  .toFile(path.join(PUB, "assets", "cat.png"));

// Square icons: the cat on the brand navy, padded to a square so it is not
// squashed at 16px.
const iconSide = Math.max(catBox.width, catBox.height);
for (const [name, size] of [
  ["favicon.png", 256],
  ["apple-touch-icon.png", 180],
]) {
  await cut(catBox, catOnly)
    .extend({
      top: Math.floor((iconSide - catBox.height) / 2),
      bottom: Math.ceil((iconSide - catBox.height) / 2),
      left: Math.floor((iconSide - catBox.width) / 2),
      right: Math.ceil((iconSide - catBox.width) / 2),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .resize(size, size, { kernel: "nearest", fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .flatten({ background: { r: NAVY[0], g: NAVY[1], b: NAVY[2] } })
    .png({ compressionLevel: 9 })
    .toFile(path.join(PUB, name));
}

console.log("wrote nyan-logo.png, assets/cat.png, favicon.png, apple-touch-icon.png");
