import { NextResponse } from "next/server";
import pkg from "../../../package.json";

export async function GET() {
  return NextResponse.json({
    ok: true,
    version: pkg.version ?? process.env.npm_package_version ?? "unknown",
  });
}
