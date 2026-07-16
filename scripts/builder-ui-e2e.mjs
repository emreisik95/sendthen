import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const HOST = "127.0.0.1";
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const NEXT_BIN = resolve(PROJECT_ROOT, "node_modules/next/dist/bin/next");
const tempDirectory = mkdtempSync(join(tmpdir(), "sendthen-builder-e2e-"));
const databasePath = join(tempDirectory, "builder-e2e.db");

const delay = (milliseconds) =>
  new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));

async function reservePort() {
  const probe = createServer();
  await new Promise((resolveListen, rejectListen) => {
    probe.once("error", rejectListen);
    probe.listen(0, HOST, resolveListen);
  });
  const address = probe.address();
  assert(address && typeof address !== "string", "Could not reserve a local port");
  await new Promise((resolveClose, rejectClose) => {
    probe.close((error) => (error ? rejectClose(error) : resolveClose()));
  });
  return address.port;
}

async function waitForServer(url, child, readLog) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Next.js exited before becoming ready.\n${readLog()}`);
    }
    try {
      const response = await fetch(`${url}/login`, {
        redirect: "manual",
        signal: AbortSignal.timeout(2_000),
      });
      if (response.status < 500) return;
    } catch {
      // The first route compile can take a few seconds.
    }
    await delay(250);
  }
  throw new Error(`Timed out waiting for Next.js.\n${readLog()}`);
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  const stopped = await Promise.race([
    once(child, "exit").then(() => true),
    delay(5_000).then(() => false),
  ]);
  if (!stopped && child.exitCode === null) {
    child.kill("SIGKILL");
    await once(child, "exit");
  }
}

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("Executable doesn't exist")) {
      throw error;
    }
    // A developer machine may already have Chrome even when Playwright's
    // matching browser bundle has not been downloaded yet. CI can keep using
    // the canonical bundle installed by `playwright install chromium`.
    return chromium.launch({ headless: true, channel: "chrome" });
  }
}

async function dragWithMouse(page, source, target, targetPosition) {
  await source.scrollIntoViewIfNeeded();
  await target.scrollIntoViewIfNeeded();
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  assert(sourceBox, "Drag source is not visible");
  assert(targetBox, "Drag target is not visible");

  const sourceX = sourceBox.x + sourceBox.width / 2;
  const sourceY = sourceBox.y + sourceBox.height / 2;
  const targetX = targetBox.x + targetPosition.x * targetBox.width;
  const targetY = targetBox.y + targetPosition.y * targetBox.height;

  await page.mouse.move(sourceX, sourceY);
  await page.mouse.down();
  await page.mouse.move(sourceX + 12, sourceY, { steps: 4 });
  await page.mouse.move(targetX, targetY, { steps: 16 });
  await delay(80);
  await page.mouse.up();
}

async function blockOrder(page) {
  return page.locator("[data-block-wrapper]").evaluateAll((wrappers) =>
    wrappers.map((wrapper) =>
      wrapper
        .querySelector('[aria-label^="Select "]')
        ?.getAttribute("aria-label"),
    ),
  );
}

async function waitForBlockOrder(page, expected) {
  await page.waitForFunction(
    (labels) => {
      const actual = [...document.querySelectorAll("[data-block-wrapper]")].map(
        (wrapper) =>
          wrapper
            .querySelector('[aria-label^="Select "]')
            ?.getAttribute("aria-label"),
      );
      return JSON.stringify(actual) === JSON.stringify(labels);
    },
    expected,
  );
  assert.deepEqual(await blockOrder(page), expected);
}

let browser;
let nextProcess;
let serverLog = "";

try {
  const port = await reservePort();
  const baseUrl = `http://${HOST}:${port}`;
  nextProcess = spawn(
    process.execPath,
    [NEXT_BIN, "dev", "--hostname", HOST, "--port", String(port)],
    {
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        DATABASE_PATH: databasePath,
        DISABLE_SIGNUP: "false",
        NEXT_TELEMETRY_DISABLED: "1",
        NODE_ENV: "development",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const captureLog = (chunk) => {
    serverLog = `${serverLog}${chunk}`.slice(-20_000);
  };
  nextProcess.stdout.on("data", captureLog);
  nextProcess.stderr.on("data", captureLog);

  await waitForServer(baseUrl, nextProcess, () => serverLog);

  browser = await launchBrowser();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    colorScheme: "dark",
  });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(`${baseUrl}/signup`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Name").fill("Builder test");
  await page.getByLabel("Email").fill("builder-e2e@sendthen.test");
  await page.getByLabel("Password").fill("builder-test-password");
  await Promise.all([
    page.waitForURL("**/onboarding", { timeout: 20_000 }),
    page.getByRole("button", { name: "Create admin account" }).click(),
  ]);

  await page.goto(`${baseUrl}/templates/builder`, {
    waitUntil: "domcontentloaded",
  });
  await page.getByRole("heading", { name: "Template builder" }).waitFor();

  const headingPalette = page.getByRole("button", {
    name: /^Heading block\./,
  });
  await headingPalette.waitFor();
  await dragWithMouse(page, headingPalette, page.locator("#template-canvas"), {
    x: 0.5,
    y: 0.35,
  });
  await waitForBlockOrder(page, ["Select Heading block"]);

  await page.getByRole("button", { name: /^Text block\./ }).click();
  await waitForBlockOrder(page, ["Select Heading block", "Select Text block"]);

  await dragWithMouse(
    page,
    page.getByRole("button", { name: "Drag to reorder Text block" }),
    page.getByRole("button", { name: "Select Heading block" }),
    { x: 0.5, y: 0.08 },
  );
  await waitForBlockOrder(page, ["Select Text block", "Select Heading block"]);

  await page.getByRole("button", { name: "Undo" }).click();
  await waitForBlockOrder(page, ["Select Heading block", "Select Text block"]);

  const headingSelection = page.getByRole("button", {
    name: "Select Heading block",
  });
  await headingSelection.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    () =>
      document
        .querySelector('[aria-label="Select Heading block"]')
        ?.getAttribute("aria-pressed") === "true",
  );

  const previewTrigger = page.getByRole("button", { name: "Preview" });
  await previewTrigger.click();
  const previewDialog = page.getByRole("dialog", { name: "Preview & export" });
  await previewDialog.waitFor();
  await page.waitForFunction(
    () => document.activeElement?.getAttribute("aria-label") === "Close preview",
  );
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() =>
      document
        .querySelector('[role="dialog"]')
        ?.contains(document.activeElement),
    ),
    true,
    "Preview focus escaped the modal",
  );
  await page.keyboard.press("Escape");
  await previewDialog.waitFor({ state: "detached" });
  await page.waitForFunction(
    () => document.activeElement?.getAttribute("aria-label") === "Preview",
  );

  assert.deepEqual(pageErrors, [], `Browser page errors:\n${pageErrors.join("\n")}`);
  console.log(
    "Builder UI E2E PASS — drag add, reorder, undo, keyboard selection, and preview focus.",
  );
} catch (error) {
  if (serverLog) console.error(serverLog);
  throw error;
} finally {
  await browser?.close();
  await stopProcess(nextProcess);
  rmSync(tempDirectory, { recursive: true, force: true });
}
