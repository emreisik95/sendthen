import Link from "next/link";
import { btnPrimary, btnSecondary } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <span className="font-mono text-lg font-medium">
        send<span className="text-lime">then</span>
      </span>
      <h1 className="font-mono text-7xl font-semibold tracking-tight text-fg sm:text-8xl">
        404
      </h1>
      <p className="max-w-md text-sm text-fg-muted">
        This page doesn&apos;t exist — but your emails will always find their
        way.
      </p>
      <div className="flex items-center gap-3">
        <Link href="/" className={btnPrimary}>
          Go home
        </Link>
        <Link href="/docs" className={btnSecondary}>
          Read the docs
        </Link>
      </div>
    </main>
  );
}
