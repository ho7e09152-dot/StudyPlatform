import fs from "node:fs/promises";
import path from "node:path";
import sharp from "../frontend/node_modules/sharp/dist/index.cjs";

const root = path.resolve("frontend/public/product-previews");
await fs.mkdir(root, { recursive: true });

const inputs = [
  ["today-desktop", "artifacts/today-polish-qa/rendered/today-desktop.png", 1200],
  ["today-mobile", "artifacts/today-polish-qa/rendered/today-mobile.png", 390],
  ["schedule-desktop", "artifacts/schedule-polish-qa/after/desktop-calendar.png", 1200],
  ["schedule-mobile", "artifacts/schedule-polish-qa/after/mobile-calendar.png", 390],
  ["library-desktop", "artifacts/library-polish-after/desktop/01-session-list.png", 1200],
  ["library-mobile", "artifacts/library-polish-after/mobile/01-session-list.png", 390],
  ["records-desktop", "artifacts/records-polish-after/desktop/01-weekly.png", 1200],
  ["records-mobile", "artifacts/records-polish-after/mobile/01-weekly.png", 390],
];

const manifest = {};
for (const [name, source, width] of inputs) {
  const target = path.join(root, `${name}.webp`);
  const info = await sharp(path.resolve(source))
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 82, effort: 5, smartSubsample: true })
    .toFile(target);
  manifest[name] = { source, target: path.relative(process.cwd(), target), width: info.width, height: info.height, bytes: info.size };
}

await fs.writeFile(path.join(root, "manifest.json"), JSON.stringify(manifest, null, 2));
process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
