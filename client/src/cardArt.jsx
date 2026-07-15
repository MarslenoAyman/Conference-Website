// Drawn, palette-matched "cards" for showcase games (Card Game, Play Station).
// Each art is a self-contained SVG card face on a transparent tile background.
// Real photos can replace these later by swapping the SVG for an <img>.

function CardFace({ accent, corner, children }) {
  return (
    <svg viewBox="0 0 120 168" className="card-face" role="img">
      <rect x="3" y="3" width="114" height="162" rx="12" className="card-face-bg" />
      <rect x="3" y="3" width="114" height="162" rx="12" className="card-face-border" fill="none" />
      {corner && (
        <>
          <text x="12" y="24" className="card-face-pip" fill={accent}>
            {corner}
          </text>
          <text x="108" y="152" className="card-face-pip" fill={accent} textAnchor="end" transform="rotate(180 108 146)">
            {corner}
          </text>
        </>
      )}
      <g transform="translate(60 84)">{children}</g>
    </svg>
  );
}

export const CARD_ART = {
  card: (
    <CardFace accent="var(--olive-dark)" corner="A">
      <path d="M0 -26 L26 0 L0 26 L-26 0 Z" fill="var(--olive)" />
    </CardFace>
  ),
  screw: (
    <CardFace accent="var(--maroon)" corner="S">
      <circle r="24" fill="none" stroke="var(--maroon)" strokeWidth="5" />
      <path d="M-14 0 H14 M0 -14 V14" stroke="var(--maroon)" strokeWidth="5" strokeLinecap="round" />
      <path d="M-9 -9 L9 9 M9 -9 L-9 9" stroke="var(--brick)" strokeWidth="3" strokeLinecap="round" />
    </CardFace>
  ),
  cochina: (
    <CardFace accent="var(--gold)" corner="C">
      <g stroke="var(--olive-dark)" strokeWidth="2.5" fill="var(--card)">
        <rect x="-26" y="-22" width="34" height="46" rx="5" transform="rotate(-14 -9 1)" />
        <rect x="-14" y="-24" width="34" height="46" rx="5" transform="rotate(0 3 -1)" />
        <rect x="-2" y="-22" width="34" height="46" rx="5" transform="rotate(14 15 1)" />
      </g>
      <path d="M15 -4 l6 6 -6 6 -6 -6 z" fill="var(--maroon)" />
    </CardFace>
  ),
  fifa: (
    <CardFace accent="var(--olive)" corner="⚽">
      <circle r="24" fill="none" stroke="var(--olive-dark)" strokeWidth="4" />
      <path d="M0 -13 l12 9 -4.6 14.2 h-14.8 L-12 -4 z" fill="var(--olive-dark)" />
      <path d="M0 -24 V-13 M22 -8 l-10 4 M-22 -8 l10 4 M13 20 l-5 -9 M-13 20 l5 -9" stroke="var(--olive-dark)" strokeWidth="2.5" />
    </CardFace>
  ),
  pes: (
    <CardFace accent="var(--brick)" corner="🎮">
      <rect x="-30" y="-14" width="60" height="30" rx="15" fill="none" stroke="var(--brick)" strokeWidth="4" />
      <path d="M-16 -4 V6 M-21 1 H-11" stroke="var(--brick)" strokeWidth="4" strokeLinecap="round" />
      <circle cx="15" cy="-2" r="3" fill="var(--maroon)" />
      <circle cx="22" cy="5" r="3" fill="var(--maroon)" />
    </CardFace>
  ),
};

export const CARD_ART_KEYS = ["screw", "cochina", "fifa", "pes", "card"];
