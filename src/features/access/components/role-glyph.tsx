/**
 * The per-role glyph on the roles list, transcribed path-for-path from the
 * five inline SVGs in `wireframe/pages/settings/roles.html`.
 *
 * Kept here rather than in `nav-icon.tsx` because these are not navigation
 * icons: the value comes out of `role.icon`, which is a column, so a role an
 * administrator creates falls back to `badge` rather than rendering nothing.
 */
const PATHS: Record<string, React.ReactNode> = {
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a6 6 0 016-6h4a6 6 0 016 6v1" />
    </>
  ),
  medal: (
    <>
      <circle cx="12" cy="9" r="5" />
      <path d="M8.5 13.5L7 21l5-2.5L17 21l-1.5-7.5" />
    </>
  ),
  crown: <path d="M3 8l4 4 5-7 5 7 4-4v10H3z" />,
  bank: <path d="M4 21V6l7-3 7 3v15M4 21h16M9 21v-5h6v5" />,
  shieldCheck: (
    <>
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  badge: (
    <>
      <circle cx="12" cy="9" r="5" />
      <path d="M8.5 13.5L7 21l5-2.5L17 21l-1.5-7.5" />
    </>
  ),
};

export function RoleGlyph({ name }: { name: string }) {
  return (
    <svg
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
      {PATHS[name] ?? PATHS.badge}
    </svg>
  );
}
