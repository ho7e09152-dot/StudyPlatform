import path from "node:path";
import sharp from "../frontend/node_modules/sharp/dist/index.mjs";

async function compose(beforePath, afterPath, outputPath, width, height) {
  const gap = 24;
  const before = await sharp(path.resolve(beforePath)).resize(width, height, { fit: "cover", position: "top" }).png().toBuffer();
  const after = await sharp(path.resolve(afterPath)).resize(width, height, { fit: "cover", position: "top" }).png().toBuffer();
  await sharp({ create: { width: width * 2 + gap, height, channels: 4, background: "#f7f6f9" } })
    .composite([{ input: before, left: 0, top: 0 }, { input: after, left: width + gap, top: 0 }])
    .png()
    .toFile(path.resolve(outputPath));
}

await compose(
  "artifacts/settings-redesign-qa/desktop/01-general.png",
  "artifacts/settings-polish-qa/desktop/01-general.png",
  "artifacts/settings-polish-qa/comparison-general-desktop.png",
  1440,
  900,
);
await compose(
  "artifacts/settings-redesign-qa/mobile/01-general.png",
  "artifacts/settings-polish-qa/mobile/01-general.png",
  "artifacts/settings-polish-qa/comparison-general-mobile.png",
  390,
  844,
);
