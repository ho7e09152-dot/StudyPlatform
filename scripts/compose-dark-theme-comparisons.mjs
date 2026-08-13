import fs from "node:fs/promises";
import path from "node:path";
import sharp from "../frontend/node_modules/sharp/dist/index.cjs";

const root = path.resolve(process.env.COMPARISON_ROOT ?? "artifacts/dark-theme-qa");
const output = path.join(root, "comparisons");
const pairs = [
  ["desktop-settings", "desktop/settings.png"],
  ["desktop-today", "desktop/today.png"],
  ["desktop-records", "desktop/records.png"],
  ["mobile-settings", "mobile/settings.png"],
  ["mobile-today", "mobile/today.png"],
  ["mobile-records", "mobile/records.png"],
];

await fs.rm(output, { recursive: true, force: true });
await fs.mkdir(output, { recursive: true });

for (const [name, relative] of pairs) {
  const beforePath = path.join(root, "before", relative);
  const afterPath = path.join(root, "after", relative);
  const before = sharp(beforePath);
  const after = sharp(afterPath);
  const [beforeMeta, afterMeta] = await Promise.all([before.metadata(), after.metadata()]);
  const width = Math.max(beforeMeta.width ?? 0, afterMeta.width ?? 0);
  const height = Math.max(beforeMeta.height ?? 0, afterMeta.height ?? 0);
  const gap = 24;
  const labelHeight = 52;
  const canvasWidth = width * 2 + gap;
  const canvasHeight = height + labelHeight;
  const labels = Buffer.from(`<svg width="${canvasWidth}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${canvasWidth}" height="${labelHeight}" fill="#0b0d12" />
    <text x="20" y="33" fill="#f5f7fb" font-family="Arial, sans-serif" font-size="18" font-weight="700">Before</text>
    <text x="${width + gap + 20}" y="33" fill="#f5f7fb" font-family="Arial, sans-serif" font-size="18" font-weight="700">After</text>
  </svg>`);
  await sharp({ create: { width: canvasWidth, height: canvasHeight, channels: 3, background: "#0b0d12" } })
    .composite([
      { input: labels, top: 0, left: 0 },
      { input: beforePath, top: labelHeight, left: 0 },
      { input: afterPath, top: labelHeight, left: width + gap },
    ])
    .png()
    .toFile(path.join(output, `${name}.png`));
}

process.stdout.write(`${output}\n`);
