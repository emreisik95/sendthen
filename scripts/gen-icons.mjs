/* Renders app/icon.svg to PNG favicons (apple-touch + og-friendly). */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const svg = readFileSync("app/icon.svg", "utf8");
const browser = await chromium.launch();

for (const [size, out] of [
  [180, "app/apple-icon.png"],
  [512, "/tmp/icon-preview.png"],
]) {
  const page = await browser.newPage({
    viewport: { width: size, height: size },
  });
  await page.setContent(
    `<style>*{margin:0}body{background:transparent}svg{width:${size}px;height:${size}px;display:block}</style>${svg}`,
  );
  await page.screenshot({ path: out, omitBackground: true });
  console.log(`✓ ${out} (${size}px)`);
}
await browser.close();
