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
    <path d="M7 15v-4M12 15V7M17 15v-6" />
  </svg>
);

export const IconMail = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </svg>
);

export const IconBroadcast = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="2" />
    <path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2" />
  </svg>
);

export const IconUsers = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M17.5 14.4a6.5 6.5 0 0 1 4 5.6" />
  </svg>
);

export const IconTemplate = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M8 8h8M8 12h8M8 16h5" />
  </svg>
);

export const IconGlobe = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
  </svg>
);

export const IconKey = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="8" cy="15" r="4.5" />
    <path d="m11.5 11.5 9-9M17 6l3 3" />
  </svg>
);

export const IconWebhook = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 4a4 4 0 0 1 4 4c0 1.2-.6 2.3-1.4 3.1L12 15" />
    <path d="M12 15a4 4 0 1 1-8 0c0-1.2.5-2.2 1.3-3" />
    <path d="M12 15h6a4 4 0 1 1-1 7.9" />
    <circle cx="12" cy="15" r="1" fill="currentColor" />
  </svg>
);

export const IconBan = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="m5.7 5.7 12.6 12.6" />
  </svg>
);

export const IconSettings = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 8h10M18 8h2M4 16h2M10 16h10" />
    <circle cx="16" cy="8" r="2" />
    <circle cx="8" cy="16" r="2" />
  </svg>
);

export const IconTeam = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="3" y="8" width="18" height="12" rx="2" />
    <path d="M8 8V6a4 4 0 0 1 8 0v2" />
  </svg>
);

export const IconChevronUpDown = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="m8 9 4-4 4 4M8 15l4 4 4-4" />
  </svg>
);
