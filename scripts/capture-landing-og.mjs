import path from "node:path";
import { chromium } from "../frontend/node_modules/playwright/index.mjs";

const baseURL = process.env.CAPTURE_BASE_URL ?? "https://sandbox.withroro.com";
const executablePath = process.env.CHROMIUM_PATH ?? "/home/roro/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell";
const browser = await chromium.launch({ headless: true, executablePath });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, locale: "ko-KR", colorScheme: "light" });
await page.goto(`${baseURL}/`, { waitUntil: "networkidle" });
await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}.public-header{position:relative!important}" });
await page.screenshot({ path: path.resolve("frontend/public/og.png") });
await browser.close();
