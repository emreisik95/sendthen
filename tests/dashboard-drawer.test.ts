import { describe, expect, it } from "vitest";
import {
  createDashboardDrawerState,
  isDashboardDrawerFocusRequestCurrent,
  transitionDashboardDrawer,
} from "@/lib/dashboard-drawer";

const openDrawer = (pathname = "/overview") =>
  transitionDashboardDrawer(createDashboardDrawerState(pathname), {
    type: "open",
  });

describe("dashboard drawer lifecycle policy", () => {
  it("opens from a closed state and invalidates earlier focus work", () => {
    const initial = createDashboardDrawerState("/overview");
    const opened = transitionDashboardDrawer(initial, { type: "open" });

    expect(opened).toEqual({
      open: true,
      pathname: "/overview",
      requestGeneration: 1,
      focusRequest: null,
      lifecycle: "mounted",
    });
  });

  it("requests opener focus after an explicit user dismissal", () => {
    const dismissed = transitionDashboardDrawer(openDrawer(), {
      type: "dismiss",
    });

    expect(dismissed.open).toBe(false);
    expect(dismissed.focusRequest).toEqual({
      target: "opener",
      generation: 2,
    });
    expect(
      isDashboardDrawerFocusRequestCurrent(
        dismissed,
        dismissed.focusRequest!,
      ),
    ).toBe(true);
  });

  it("requests main-content focus after navigation", () => {
    const navigated = transitionDashboardDrawer(openDrawer(), {
      type: "navigate",
    });

    expect(navigated.open).toBe(false);
    expect(navigated.focusRequest).toEqual({
      target: "main-content",
      generation: 2,
    });
  });

  it("ignores a mobile breakpoint event and closes for desktop", () => {
    const open = openDrawer();
    const stillMobile = transitionDashboardDrawer(open, {
      type: "breakpoint",
      desktop: false,
    });
    const desktop = transitionDashboardDrawer(open, {
      type: "breakpoint",
      desktop: true,
    });

    expect(stillMobile).toBe(open);
    expect(desktop.open).toBe(false);
    expect(desktop.focusRequest).toEqual({
      target: "main-content",
      generation: 2,
    });
  });

  it("treats an unchanged pathname as a no-op", () => {
    const open = openDrawer("/emails");

    expect(
      transitionDashboardDrawer(open, {
        type: "pathname",
        pathname: "/emails",
      }),
    ).toBe(open);
  });

  it("closes and requests main-content focus when pathname changes", () => {
    const changed = transitionDashboardDrawer(openDrawer("/emails"), {
      type: "pathname",
      pathname: "/emails/message-1",
    });

    expect(changed.pathname).toBe("/emails/message-1");
    expect(changed.open).toBe(false);
    expect(changed.focusRequest).toEqual({
      target: "main-content",
      generation: 2,
    });
  });

  it("invalidates a stale close focus request when reopened rapidly", () => {
    const dismissed = transitionDashboardDrawer(openDrawer(), {
      type: "dismiss",
    });
    const staleRequest = dismissed.focusRequest!;
    const reopened = transitionDashboardDrawer(dismissed, { type: "open" });

    expect(reopened.open).toBe(true);
    expect(reopened.focusRequest).toBeNull();
    expect(reopened.requestGeneration).toBe(3);
    expect(
      isDashboardDrawerFocusRequestCurrent(reopened, staleRequest),
    ).toBe(false);
  });

  it("marks unmount cleanup and invalidates pending focus", () => {
    const dismissed = transitionDashboardDrawer(openDrawer(), {
      type: "dismiss",
    });
    const staleRequest = dismissed.focusRequest!;
    const unmounted = transitionDashboardDrawer(dismissed, {
      type: "unmount",
    });

    expect(unmounted.lifecycle).toBe("unmounted");
    expect(unmounted.open).toBe(false);
    expect(unmounted.focusRequest).toBeNull();
    expect(unmounted.requestGeneration).toBe(3);
    expect(
      isDashboardDrawerFocusRequestCurrent(unmounted, staleRequest),
    ).toBe(false);
  });
});
