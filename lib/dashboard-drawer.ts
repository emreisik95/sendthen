export type DashboardDrawerFocusTarget = "opener" | "main-content";

export type DashboardDrawerFocusRequest = Readonly<{
  target: DashboardDrawerFocusTarget;
  generation: number;
}>;

export type DashboardDrawerState = Readonly<{
  open: boolean;
  pathname: string;
  requestGeneration: number;
  focusRequest: DashboardDrawerFocusRequest | null;
  lifecycle: "mounted" | "unmounted";
}>;

export type DashboardDrawerEvent =
  | Readonly<{ type: "open" }>
  | Readonly<{ type: "dismiss" }>
  | Readonly<{ type: "navigate" }>
  | Readonly<{ type: "pathname"; pathname: string }>
  | Readonly<{ type: "breakpoint"; desktop: boolean }>
  | Readonly<{ type: "focus-complete"; generation: number }>
  | Readonly<{ type: "unmount" }>;

export function createDashboardDrawerState(
  pathname: string,
): DashboardDrawerState {
  return {
    open: false,
    pathname,
    requestGeneration: 0,
    focusRequest: null,
    lifecycle: "mounted",
  };
}

function closeWithFocus(
  state: DashboardDrawerState,
  target: DashboardDrawerFocusTarget,
): DashboardDrawerState {
  if (
    state.lifecycle === "unmounted" ||
    (!state.open && state.focusRequest === null)
  ) {
    return state;
  }

  const requestGeneration = state.requestGeneration + 1;
  return {
    ...state,
    open: false,
    requestGeneration,
    focusRequest: { target, generation: requestGeneration },
  };
}

export function isDashboardDrawerFocusRequestCurrent(
  state: DashboardDrawerState,
  request: DashboardDrawerFocusRequest,
): boolean {
  return (
    state.lifecycle === "mounted" &&
    !state.open &&
    state.requestGeneration === request.generation &&
    state.focusRequest?.generation === request.generation &&
    state.focusRequest.target === request.target
  );
}

export function transitionDashboardDrawer(
  state: DashboardDrawerState,
  event: DashboardDrawerEvent,
): DashboardDrawerState {
  switch (event.type) {
    case "open": {
      if (state.lifecycle === "unmounted" || state.open) return state;
      return {
        ...state,
        open: true,
        requestGeneration: state.requestGeneration + 1,
        focusRequest: null,
      };
    }

    case "dismiss":
      return state.open ? closeWithFocus(state, "opener") : state;

    case "navigate":
      return closeWithFocus(state, "main-content");

    case "pathname": {
      if (event.pathname === state.pathname) return state;

      const withPathname = { ...state, pathname: event.pathname };
      return state.open || state.focusRequest
        ? closeWithFocus(withPathname, "main-content")
        : withPathname;
    }

    case "breakpoint":
      return event.desktop
        ? closeWithFocus(state, "main-content")
        : state;

    case "focus-complete":
      return state.focusRequest?.generation === event.generation
        ? { ...state, focusRequest: null }
        : state;

    case "unmount":
      return state.lifecycle === "unmounted"
        ? state
        : {
            ...state,
            open: false,
            requestGeneration: state.requestGeneration + 1,
            focusRequest: null,
            lifecycle: "unmounted",
          };
  }
}
