import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "../frontend/node_modules/playwright/index.mjs";
import sharp from "../frontend/node_modules/sharp/dist/index.cjs";

const baseURL = process.env.CAPTURE_BASE_URL ?? "http://127.0.0.1:3210";
const outputRoot = path.resolve("artifacts/brand-refresh");
const previewRoot = path.resolve("frontend/public/product-previews");
const executablePath = process.env.CHROMIUM_PATH ?? "/home/roro/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell";
const browser = await chromium.launch({ headless: true, executablePath });
await fs.rm(outputRoot, { recursive: true, force: true });
await fs.mkdir(path.join(outputRoot, "desktop"), { recursive: true });
await fs.mkdir(path.join(outputRoot, "mobile"), { recursive: true });
await fs.mkdir(previewRoot, { recursive: true });

const productRoutes = [
  ["today", "/today"],
  ["schedule", "/schedule"],
  ["library", "/library"],
  ["records", "/records"],
];
const results = [];

for (const [viewportName, viewport] of [["desktop", { width: 1200, height: 917 }], ["mobile", { width: 390, height: 844 }]]) {
  const context = await browser.newContext({ viewport, locale: "ko-KR", timezoneId: "Asia/Seoul", colorScheme: "light" });
  for (const [name, route] of productRoutes) {
    const page = await context.newPage();
    await page.goto(`${baseURL}${route}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(250);
    const source = path.join(outputRoot, viewportName, `${name}.png`);
    await page.screenshot({ path: source, fullPage: viewportName === "mobile" });
    const target = path.join(previewRoot, `${name}-${viewportName}.webp`);
    const info = await sharp(source).resize({ width: viewport.width, withoutEnlargement: true }).webp({ quality: 82, effort: 5, smartSubsample: true }).toFile(target);
    const metrics = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    results.push({ viewport: viewportName, route, source, target, width: info.width, height: info.height, bytes: info.size, horizontalOverflow: metrics.scrollWidth > metrics.width + 1 });
    await page.close();
  }
  await context.close();
}

const manifest = Object.fromEntries(results.map((item) => [`${path.basename(item.source, ".png")}-${item.viewport}`, {
  source: path.relative(process.cwd(), item.source),
  target: path.relative(process.cwd(), item.target),
  width: item.width,
  height: item.height,
  bytes: item.bytes,
}]))
await fs.writeFile(path.join(previewRoot, "manifest.json"), JSON.stringify(manifest, null, 2));

for (const [viewportName, viewport] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
  const context = await browser.newContext({ viewport, locale: "ko-KR", timezoneId: "Asia/Seoul", colorScheme: "light" });
  for (const [name, route] of [["landing", "/"], ["login", "/login"], ["today", "/today"]]) {
    const page = await context.newPage();
    await page.goto(`${baseURL}${route}`, { waitUntil: "networkidle" });
    if (route === "/") {
      await page.waitForFunction(() => [...document.images].filter((image) => image.getBoundingClientRect().top < innerHeight).every((image) => image.complete && image.naturalWidth > 0));
    }
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(outputRoot, viewportName, `${name}-final.png`), fullPage: name === "landing" });
    const metrics = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    results.push({ viewport: viewportName, route, final: true, horizontalOverflow: metrics.scrollWidth > metrics.width + 1 });
    await page.close();
  }
  await context.close();
}

const ogPage = await browser.newPage({ viewport: { width: 1200, height: 630 }, locale: "ko-KR", colorScheme: "light" });
await ogPage.goto(`${baseURL}/`, { waitUntil: "networkidle" });
await ogPage.waitForFunction(() => [...document.images].filter((image) => image.getBoundingClientRect().top < innerHeight).every((image) => image.complete && image.naturalWidth > 0));
await ogPage.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}.public-header{position:relative!important}" });
await ogPage.screenshot({ path: path.resolve("frontend/public/og.png") });
await ogPage.close();

await browser.close();
await fs.writeFile(path.join(outputRoot, "qa-results.json"), JSON.stringify(results, null, 2));
process.stdout.write(`${JSON.stringify({ captures: results.length, overflow: results.filter((item) => item.horizontalOverflow) }, null, 2)}\n`);
