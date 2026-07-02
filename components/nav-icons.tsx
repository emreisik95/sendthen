import type { SVGProps } from "react";

const base = (props: SVGProps<SVGSVGElement>) => ({
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  ...props,
});

export const IconChart = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3 3v18h18" />
    <path className="i-grow" d="M7 15v-4M12 15V7M17 15v-6" />
  </svg>
);

export const IconMail = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path className="i-draw" d="m3 7 9 6 9-6" />
  </svg>
);

export const IconBroadcast = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="2" />
    <path
      className="i-ripple-1"
      d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4"
    />
    <path
      className="i-ripple-2"
      d="M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2"
    />
  </svg>
);

export const IconUsers = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <path
      className="i-nudge"
      d="M16 4.6a3.5 3.5 0 0 1 0 6.8M17.5 14.4a6.5 6.5 0 0 1 4 5.6"
    />
  </svg>
);

export const IconTemplate = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path className="i-draw" d="M8 8h8M8 12h8M8 16h5" />
  </svg>
);

export const IconGlobe = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path
      className="i-wobble"
      d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"
    />
  </svg>
);

export const IconKey = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} className={`i-turn ${p.className ?? ""}`}>
    <circle cx="8" cy="15" r="4.5" />
    <path d="m11.5 11.5 9-9M17 6l3 3" />
  </svg>
);

export const IconWebhook = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} className={`i-wobble ${p.className ?? ""}`}>
    <path d="M12 4a4 4 0 0 1 4 4c0 1.2-.6 2.3-1.4 3.1L12 15" />
    <path d="M12 15a4 4 0 1 1-8 0c0-1.2.5-2.2 1.3-3" />
    <path d="M12 15h6a4 4 0 1 1-1 7.9" />
    <circle cx="12" cy="15" r="1" fill="currentColor" />
  </svg>
);

export const IconBan = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path className="i-draw" d="m5.7 5.7 12.6 12.6" />
  </svg>
);

export const IconSettings = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 8h10M18 8h2M4 16h2M10 16h10" />
    <circle className="i-knob-r" cx="16" cy="8" r="2" />
    <circle className="i-knob-l" cx="8" cy="16" r="2" />
  </svg>
);

export const IconTeam = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} className={`i-bounce ${p.className ?? ""}`}>
    <rect x="3" y="8" width="18" height="12" rx="2" />
    <path d="M8 8V6a4 4 0 0 1 8 0v2" />
  </svg>
);

export const IconMetrics = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path className="i-draw" d="m3 17 5-6 4 3 6-8 3 3" />
    <path d="M3 21h18" />
  </svg>
);

export const IconBook = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2z" />
    <path d="M4 19a2 2 0 0 1 2-2h14" />
  </svg>
);

export const IconGitHub = (p: SVGProps<SVGSVGElement>) => (
  <svg
    width={16}
    height={16}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden
    {...p}
  >
    <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.72.5.1.68-.22.68-.49 0-.24-.01-.87-.01-1.7-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.63.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.9 1.57 2.36 1.12 2.94.85.09-.66.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.7 0 0 .84-.28 2.75 1.05a9.36 9.36 0 0 1 5 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.4.2 2.44.1 2.7.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .27.18.6.69.49A10.05 10.05 0 0 0 22 12.25C22 6.58 17.52 2 12 2z" />
  </svg>
);

export const IconCard = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="3" y="6" width="18" height="13" rx="2" />
    <path className="i-draw" d="M3 10h18M7 15h4" />
  </svg>
);

export const IconChevronUpDown = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="m8 9 4-4 4 4M8 15l4 4 4-4" />
  </svg>
);

export const IconUser = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </svg>
);

export const IconLogout = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
    <path d="M10 8 6 12l4 4M6 12h10" />
  </svg>
);
