import path from "node:path";
import sharp from "../frontend/node_modules/sharp/dist/index.mjs";

const sourcePath = path.resolve("docs/images/screenshots/settings.png");
const implementationPath = path.resolve("artifacts/settings-redesign-qa/desktop/01-general.png");
const outputPath = path.resolve("artifacts/settings-redesign-qa/comparison-before-after.png");
const width = 1440;
const height = 900;
const gap = 24;

const source = await sharp(sourcePath).resize(width, height, { fit: "cover", position: "top" }).png().toBuffer();
const implementation = await sharp(implementationPath).extract({ left: 0, top: 0, width, height }).png().toBuffer();

await sharp({
  create: { width: width * 2 + gap, height, channels: 4, background: "#f7f6f9" },
})
  .composite([{ input: source, left: 0, top: 0 }, { input: implementation, left: width + gap, top: 0 }])
  .png()
  .toFile(outputPath);
