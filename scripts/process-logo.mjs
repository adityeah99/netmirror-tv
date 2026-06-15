import sharp from "sharp";

const SRC = "public/logo.png";

// 1) Transparent mark for the header/footer.
// The background is neutral dark; the logo is red (+ a white fold highlight).
// Key on "redness" and "brightness" so dark-red logo facets survive but the
// neutral/dark-red glow background is removed cleanly.
const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;
const alpha = new Float32Array(width * height);
for (let p = 0, i = 0; p < width * height; p++, i += channels) {
  const r = data[i], g = data[i + 1], b = data[i + 2];
  const redness = r - Math.max(g, b);
  const bright = Math.min(r, g, b);
  let a;
  if (bright > 155) a = 255;                        // true white fold highlight only
  else if (r > 100 && redness > 50) a = 255;        // solid red
  else if (r > 80 && redness > 28) a = ((redness - 28) / 22) * 255; // soft red edge
  else a = 0;                                       // neutral / dark glow / light fringe
  alpha[p] = Math.min(a, 255);
}
// erode (min filter, radius 2) to eat the thin light fringe around the edges
const at = (arr, x, y) => (x < 0 || x >= width || y < 0 || y >= height ? 0 : arr[y * width + x]);
const eroded = new Float32Array(width * height);
const R = 2;
for (let y = 0; y < height; y++)
  for (let x = 0; x < width; x++) {
    let m = 255;
    for (let dy = -R; dy <= R; dy++)
      for (let dx = -R; dx <= R; dx++) m = Math.min(m, at(alpha, x + dx, y + dy));
    eroded[y * width + x] = m;
  }
// feather: box blur on the eroded alpha for smooth edges
const blurred = new Float32Array(width * height);
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    let sum = 0, n = 0;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) { sum += at(eroded, x + dx, y + dy); n++; }
    blurred[y * width + x] = sum / n;
  }
}
for (let p = 0, i = 0; p < width * height; p++, i += channels) {
  data[i + 3] = Math.round(Math.min(blurred[p], data[i + 3]));
}
const keyed = await sharp(data, { raw: { width, height, channels } }).png().toBuffer();
await sharp(keyed)
  .trim({ threshold: 10 })
  .resize({ height: 256 })   // supersample for crisp downscale in the UI
  .png()
  .toFile("public/logo-mark.png");

// 2) Favicons — keep the original dark background (app-icon look), square it.
const square = (size, out) =>
  sharp(SRC)
    .resize(size, size, { fit: "contain", background: { r: 8, g: 8, b: 10, alpha: 1 } })
    .png()
    .toFile(out);
await square(32, "public/favicon-32.png");
await square(48, "public/favicon-48.png");
await square(180, "public/apple-touch-icon.png");
await square(512, "public/icon-512.png");

console.log("done");
