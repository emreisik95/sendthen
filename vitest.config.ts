import { defineConfig } from "vitest/config";
import path from "node:path";
import fs from "node:fs";

const tmp = path.join(__dirname, ".test-tmp");
fs.rmSync(tmp, { recursive: true, force: true });

export default defineConfig({
  resolve: {
    alias: { "@": __dirname },
  },
  test: {
    env: {
      DATABASE_PATH: path.join(tmp, "test.db"),
      SENDTHEN_OUTBOX_DIR: path.join(tmp, "outbox"),
      SENDTHEN_MAIL_MODE: "sandbox",
      SENDTHEN_DNS_MOCK: "verified",
      ADMIN_PASSWORD: "test-admin",
    },
    pool: "forks",
    fileParallelism: false,
  },
});
