/* Renders the 1200x630 Open Graph image to public/og.png */
import { chromium } from "playwright";

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px; background: #08090A; color: #F4F5F6;
    font-family: -apple-system, 'Inter', 'Segoe UI', sans-serif;
    position: relative; overflow: hidden; padding: 72px 80px;
    display: flex; flex-direction: column; justify-content: space-between;
  }
  .grid {
    position: absolute; inset: 0;
    background-image: linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
    background-size: 56px 56px;
    mask-image: radial-gradient(ellipse 90% 80% at 30% 20%, black 30%, transparent 75%);
  }
  .halo {
    position: absolute; left: -160px; top: -260px; width: 700px; height: 520px;
    background: rgba(198,255,0,0.22); filter: blur(140px); border-radius: 50%;
  }
  .mark { font-family: 'JetBrains Mono', 'SF Mono', Menlo, monospace; font-size: 30px; font-weight: 600; }
  .mark b { color: #C6FF00; font-weight: 600; }
  h1 { font-size: 84px; font-weight: 800; letter-spacing: -3px; line-height: 1.02; max-width: 900px; }
  h1 span { color: #C6FF00; }
  .sub { margin-top: 22px; font-size: 28px; color: #9BA1A6; max-width: 760px; line-height: 1.4; }
  .trace {
    position: absolute; right: -40px; bottom: 150px; width: 470px;
    background: #101113; border: 1px solid #222629; border-radius: 14px;
    padding: 22px 26px; font-family: 'JetBrains Mono', Menlo, monospace;
    font-size: 15.5px; line-height: 2; color: #9BA1A6;
    box-shadow: 0 0 80px rgba(198,255,0,0.08);
    transform: rotate(-2deg);
  }
  .trace .t { color: #5C6166; margin-right: 14px; }
  .g { color: #C6FF00; } .b { color: #38BDF8; }
  .foot { display: flex; justify-content: space-between; align-items: flex-end;
    font-family: 'JetBrains Mono', Menlo, monospace; font-size: 22px; color: #5C6166; z-index: 2; }
  .foot .url { color: #C6FF00; }
  .content { z-index: 2; }
</style></head><body>
  <div class="grid"></div><div class="halo"></div>
  <div class="content">
    <div class="mark">send<b>then</b></div>
    <h1 style="margin-top:54px">Email that is<br><span>deliverable.</span></h1>
    <div class="sub">Open-source, self-hosted email platform — API, dashboard, DKIM, broadcasts, inbound.</div>
  </div>
  <div class="trace">
    <div><span class="t">09:31:04.012</span><span class="b">queued</span></div>
    <div><span class="t">09:31:04.019</span>signing · DKIM</div>
    <div><span class="t">09:31:04.214</span><span class="b">sent</span> · 250 OK</div>
    <div><span class="t">09:31:04.220</span><span class="g">delivered ✓</span></div>
    <div><span class="t">09:31:04.226</span><span class="g">webhook → 200</span></div>
  </div>
  <div class="foot">
    <span class="url">sendthen.net</span>
    <span>MIT · one container · your data</span>
  </div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html, { waitUntil: "networkidle" });
await page.screenshot({ path: "public/og.png" });
await browser.close();
console.log("✓ public/og.png (1200x630)");
