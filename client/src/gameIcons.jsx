export const GAME_ICONS = {
  football: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8.5l2.5 1.8-1 2.9h-3l-1-2.9L12 8.5Z" fill="currentColor" stroke="none" />
      <path d="M12 3.2v3.1M6.2 7l2.6 1.9M17.8 7l-2.6 1.9M8.3 17.4l1.2-2.9M15.7 17.4l-1.2-2.9" />
    </svg>
  ),
  volleyball: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3c3 2.5 3 15 0 18" />
      <path d="M4 9c3.5-2 12.5-2 16 0" />
      <path d="M4 15c3.5 2 12.5 2 16 0" />
    </svg>
  ),
  chess: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="6" r="2" />
      <path d="M12 8v2" />
      <path d="M8.5 20h7l-1-6.5a3 3 0 0 0-5 0L8.5 20Z" />
      <path d="M7 20h10" />
    </svg>
  ),
  billiard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="9" r="3.2" />
      <circle cx="16" cy="16" r="3.2" />
      <circle cx="16" cy="16" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  pingpong: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8.5" cy="8.5" r="4.5" />
      <path d="M11.8 11.8L18 18" />
      <circle cx="19.3" cy="19.3" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  ),
  ball: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5L12 3Z" />
    </svg>
  ),
};

export const GAME_ICON_COLORS = {
  football: "var(--olive)",
  volleyball: "var(--gold)",
  chess: "var(--maroon)",
  billiard: "var(--olive-dark)",
  pingpong: "var(--brick)",
  ball: "var(--ink-soft)",
};

export const GAME_ICON_KEYS = ["football", "volleyball", "chess", "billiard", "pingpong", "ball"];
