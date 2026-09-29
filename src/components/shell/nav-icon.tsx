import type { NavIcon as NavIconName } from "@/config/nav";

/**
 * Stroke-only icon set, ported from the wireframe's ICONS map in shell.js.
 * Kept as inline paths rather than an icon package so the sidebar renders
 * with zero client JS and the shapes stay identical to the approved design.
 */
const PATHS: Record<NavIconName, React.ReactNode> = {
  grid: <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />,
  inbox: <path d="M3 12h4l2 3h6l2-3h4M5 5h14l2 7v7H3v-7z" />,
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </>
  ),
  revert: <path d="M3 10h11a5 5 0 110 10H9M3 10l4-4M3 10l4 4" />,
  users: (
    <>
      <path d="M16 19v-1.5a3.5 3.5 0 00-3.5-3.5h-5A3.5 3.5 0 004 17.5V19" />
      <circle cx="10" cy="8" r="3.2" />
      <path d="M17 11.2a3 3 0 000-6M20 19v-1.4a3.4 3.4 0 00-2.5-3.2" />
    </>
  ),
  team: (
    <>
      <path d="M12 3v4M6 21v-4a3 3 0 013-3h6a3 3 0 013 3v4M12 7l-6 4M12 7l6 4" />
      <circle cx="12" cy="4" r="1.6" />
    </>
  ),
  building: (
    <path d="M4 21V6l7-3 7 3v15M4 21h16M9 21v-5h6v5M8 9h.01M12 9h.01M16 9h.01M8 13h.01M12 13h.01M16 13h.01" />
  ),
  org: <path d="M9 4h6v4H9zM3 16h6v4H3zM15 16h6v4h-6zM12 8v4M6 16v-2h12v2" />,
  crown: <path d="M3 8l4 4 5-7 5 7 4-4v10H3z" />,
  badge: (
    <>
      <circle cx="12" cy="9" r="5" />
      <path d="M8.5 13.5L7 21l5-2.5L17 21l-1.5-7.5" />
    </>
  ),
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  history: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  cog: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1V21a2 2 0 11-4 0v-.1A1.6 1.6 0 007.5 19l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.6 1.6 0 003 15H3a2 2 0 110-4h.1A1.6 1.6 0 004.7 9.3l-.1-.1a2 2 0 112.8-2.8l.1.1A1.6 1.6 0 0010 5.1V5a2 2 0 114 0v.1a1.6 1.6 0 002.7 1.1l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 001.1 2.7H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1.3z" />
    </>
  ),
  swatch: (
    <>
      <path d="M4 4h7v16a3.5 3.5 0 01-7 0zM11 9l5-5 4 4-5 5M11 20h8a1 1 0 001-1v-4H11" />
      <circle cx="7.5" cy="16.5" r=".6" />
    </>
  ),
};

export function NavIcon({ name, className }: { name: NavIconName; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
