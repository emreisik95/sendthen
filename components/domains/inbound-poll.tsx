"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const POLL_MS = 20_000;

/**
 * Polls the server for a newly-arrived test inbound message by refreshing
 * this (force-dynamic) server component on an interval. Render only while
 * no inbound message has been received yet for the domain — once one
 * shows up the parent stops mounting this and polling ends.
 */
export function InboundPoll() {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(t);
  }, [router]);
  return null;
}
