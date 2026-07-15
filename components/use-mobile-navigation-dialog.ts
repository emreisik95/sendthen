"use client";

import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type SyntheticEvent,
} from "react";
import {
  createDashboardDrawerState,
  isDashboardDrawerFocusRequestCurrent,
  transitionDashboardDrawer,
} from "@/lib/dashboard-drawer";

type UseMobileNavigationDialogOptions = Readonly<{
  pathname: string;
}>;

export function useMobileNavigationDialog({
  pathname,
}: UseMobileNavigationDialogOptions) {
  const [drawerState, dispatch] = useReducer(
    transitionDashboardDrawer,
    pathname,
    createDashboardDrawerState,
  );
  const drawerStateRef = useRef(drawerState);
  drawerStateRef.current = drawerState;

  const dialogRef = useRef<HTMLDialogElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const pendingFocusAnimationFrameRef = useRef<number | null>(null);

  const cancelPendingFocusAnimationFrame = useCallback(() => {
    if (pendingFocusAnimationFrameRef.current === null) return;
    cancelAnimationFrame(pendingFocusAnimationFrameRef.current);
    pendingFocusAnimationFrameRef.current = null;
  }, []);

  const openMobileNavigation = useCallback(() => {
    cancelPendingFocusAnimationFrame();
    dispatch({ type: "open" });
  }, [cancelPendingFocusAnimationFrame]);

  const dismissMobileNavigation = useCallback(() => {
    dispatch({ type: "dismiss" });
  }, []);

  const closeMobileNavigationWithoutFocus = useCallback(() => {
    dispatch({ type: "navigate" });
  }, []);

  const handleDialogCancel = useCallback(
    (event: SyntheticEvent<HTMLDialogElement>) => {
      event.preventDefault();
      dismissMobileNavigation();
    },
    [dismissMobileNavigation],
  );

  const handleDialogBackdropClick = useCallback(
    (event: ReactMouseEvent<HTMLDialogElement>) => {
      if (event.target === event.currentTarget) dismissMobileNavigation();
    },
    [dismissMobileNavigation],
  );

  const handleDialogClose = useCallback(() => {
    if (drawerStateRef.current.open) dispatch({ type: "dismiss" });
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (drawerState.open) {
      cancelPendingFocusAnimationFrame();
      if (!dialog.open) dialog.showModal();
      closeButtonRef.current?.focus();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [cancelPendingFocusAnimationFrame, drawerState.open]);

  useEffect(() => {
    if (!drawerState.open) return;

    const previousDocumentOverflow =
      document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      document.documentElement.style.overflow = previousDocumentOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [drawerState.open]);

  useEffect(() => {
    const request = drawerState.focusRequest;
    if (!request) return;

    cancelPendingFocusAnimationFrame();
    pendingFocusAnimationFrameRef.current = requestAnimationFrame(() => {
      pendingFocusAnimationFrameRef.current = null;
      const currentState = drawerStateRef.current;
      if (
        dialogRef.current?.open ||
        !isDashboardDrawerFocusRequestCurrent(currentState, request)
      ) {
        return;
      }

      const target =
        request.target === "opener"
          ? menuButtonRef.current
          : document.getElementById("main-content");
      target?.focus({ preventScroll: true });
      dispatch({ type: "focus-complete", generation: request.generation });
    });

    return cancelPendingFocusAnimationFrame;
  }, [
    cancelPendingFocusAnimationFrame,
    drawerState.focusRequest,
  ]);

  useEffect(() => {
    dispatch({ type: "pathname", pathname });
  }, [pathname]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const handleBreakpointChange = (event: MediaQueryListEvent) => {
      dispatch({ type: "breakpoint", desktop: event.matches });
    };

    if (mediaQuery.matches) {
      dispatch({ type: "breakpoint", desktop: true });
    }

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleBreakpointChange);
      return () =>
        mediaQuery.removeEventListener("change", handleBreakpointChange);
    }

    mediaQuery.addListener(handleBreakpointChange);
    return () => mediaQuery.removeListener(handleBreakpointChange);
  }, []);

  useEffect(
    () => () => {
      cancelPendingFocusAnimationFrame();
      drawerStateRef.current = transitionDashboardDrawer(
        drawerStateRef.current,
        { type: "unmount" },
      );
    },
    [cancelPendingFocusAnimationFrame],
  );

  return {
    mobileNavigationOpen: drawerState.open,
    dialogRef,
    menuButtonRef,
    closeButtonRef,
    openMobileNavigation,
    dismissMobileNavigation,
    closeMobileNavigationWithoutFocus,
    handleDialogCancel,
    handleDialogBackdropClick,
    handleDialogClose,
  } as const;
}
