import fs from "node:fs/promises";
import path from "node:path";
import sharp from "../frontend/node_modules/sharp/dist/index.mjs";

const root = path.resolve("artifacts");
const source = path.resolve(process.env.WORKSPACE_COMPARISON_BEFORE ?? path.join(root, "workspace-redesign-qa", "desktop"));
const implementation = path.resolve(process.env.WORKSPACE_COMPARISON_AFTER ?? path.join(root, "workspace-polish-after", "desktop"));
const output = path.resolve(process.env.WORKSPACE_COMPARISON_OUTPUT ?? path.join(root, "workspace-polish-after", "comparisons"));

const pairs = [
  ["01-workspace-hub.png", "01-workspace-hub.png", "01-workspace-hub.png"],
  ["07-existing-study-data.png", "07-existing-study-data.png", "02-existing-data.png"],
  ["09-conflict.png", "09-conflict.png", "03-conflict.png"],
  ["10-permission-denied.png", "10-permission-denied.png", "04-permission-denied.png"],
  ["12-first-workspace.png", "12-first-workspace.png", "05-first-workspace.png"],
  ["13-profile-onboarding.png", "13-profile-onboarding.png", "06-profile-onboarding.png"],
];

await fs.mkdir(output, { recursive: true });

for (const [beforeName, afterName, outputName] of pairs) {
  const beforePath = path.join(source, beforeName);
  const afterPath = path.join(implementation, afterName);
  const [beforeMeta, afterMeta] = await Promise.all([sharp(beforePath).metadata(), sharp(afterPath).metadata()]);
  const width = Math.max(beforeMeta.width ?? 1440, afterMeta.width ?? 1440);
  const height = Math.max(beforeMeta.height ?? 1050, afterMeta.height ?? 1050);
  const before = await sharp(beforePath).extend({ top: 0, left: 0, right: width - (beforeMeta.width ?? width), bottom: height - (beforeMeta.height ?? height), background: "#f7f7f9" }).png().toBuffer();
  const after = await sharp(afterPath).extend({ top: 0, left: 0, right: width - (afterMeta.width ?? width), bottom: height - (afterMeta.height ?? height), background: "#f7f7f9" }).png().toBuffer();
  await sharp({ create: { width: width * 2 + 24, height, channels: 4, background: "#e2e2e8" } })
    .composite([{ input: before, left: 0, top: 0 }, { input: after, left: width + 24, top: 0 }])
    .png()
    .toFile(path.join(output, outputName));
}
