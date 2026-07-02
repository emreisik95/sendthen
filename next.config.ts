import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3", "nodemailer"],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
