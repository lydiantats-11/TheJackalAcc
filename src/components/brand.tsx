/** Jackal Accountant brand marks — original geometric drawings (no third-party artwork). */

/** A jackal's head in profile, drawn from straight facets, inside a rounded tile. */
export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect width="40" height="40" rx="10" fill="var(--navy-800)" />
      <path d="M9 31 12.5 8.5l5 7.2L22 7.5l2.6 9.8 8.4 6.1-1.6 3.4-7.4.4L18 32z" fill="var(--logo-mark)" />
      <path d="M12.5 8.5 15 20l2.5-4.3zM22 7.5l-.6 9.8 3.2 0z" fill="var(--navy-800)" opacity=".35" />
      <circle cx="24.2" cy="20.6" r="1.35" fill="var(--navy-800)" />
      <path d="M31.4 26.8 28.6 30" stroke="var(--logo-mark)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/**
 * The Acropolis at Athens as a calm line illustration: the rock, the Parthenon's stylobate, eight Doric columns,
 * entablature and pediment, a low sun and an olive branch. Colours follow the theme tokens (light and dark).
 */
export function AcropolisArt({ className, label = "Η Ακρόπολη της Αθήνας" }: { className?: string; label?: string }) {
  const cols = Array.from({ length: 8 }, (_, i) => 168 + i * 31);
  return (
    <svg viewBox="0 0 520 380" className={className} role="img" aria-label={label}>
      <defs>
        <linearGradient id="ja-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--art-sky-top)" />
          <stop offset="1" stopColor="var(--art-sky-bottom)" />
        </linearGradient>
      </defs>
      <rect width="520" height="380" rx="28" fill="url(#ja-sky)" />
      <circle cx="402" cy="102" r="46" fill="var(--art-sun)" opacity=".85" />
      {/* distant hills */}
      <path d="M0 268c60-18 110-30 170-26s120 22 180 18 110-22 170-20v160H0z" fill="var(--art-hill-far)" />
      {/* the rock */}
      <path d="M64 300c18-34 40-52 78-58l52-6h170c30 4 52 18 70 40l22 24H64z" fill="var(--art-rock)" />
      <path d="M100 286c40-6 80-4 120 2M300 288c40-6 70-4 100 4" stroke="var(--art-line)" strokeWidth="1.5" fill="none" opacity=".35" />
      {/* the Parthenon */}
      <g stroke="var(--art-line)" strokeWidth="2.2" fill="var(--art-temple)" strokeLinejoin="round">
        <path d="M150 236h234v-8H150zM156 228h222v-7H156z" />
        {cols.map((x) => <rect key={x} x={x} y={150} width="14" height="71" />)}
        <path d="M156 150h222v-14H156z" />
        <path d="M160 136 267 104l107 32z" />
      </g>
      <g stroke="var(--art-line)" strokeWidth="1.4" opacity=".5">
        {cols.map((x) => <path key={x} d={`M${x + 4.5} 154v63M${x + 9.5} 154v63`} />)}
        <path d="M160 143h214" />
      </g>
      {/* olive branch */}
      <g fill="var(--art-leaf)" stroke="none">
        <path d="M18 372c40-40 84-62 140-70" stroke="var(--art-stem)" strokeWidth="2.5" fill="none" />
        {[[40, 352, -40], [62, 336, -30], [86, 323, -24], [110, 313, -16], [134, 306, -10], [56, 356, 20], [80, 342, 26], [104, 330, 30], [128, 320, 34]].map(([x, y, r]) => (
          <ellipse key={`${x}-${y}`} cx={x} cy={y} rx="12" ry="4.6" transform={`rotate(${r} ${x} ${y})`} opacity=".9" />
        ))}
        <circle cx="96" cy="336" r="3.4" fill="var(--navy-800)" />
        <circle cx="122" cy="324" r="3" fill="var(--navy-800)" />
      </g>
    </svg>
  );
}
