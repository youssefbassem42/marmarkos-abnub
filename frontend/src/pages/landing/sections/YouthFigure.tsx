type Props = {
  className?: string;
  color?: string;
  flip?: boolean;
};

/**
 * Decorative raised-arms youth silhouette inspired by the church logo.
 * Stroke-based with rounded caps: head, torso, arms lifted in praise,
 * and legs mid-jump.
 */
export function YouthFigure({
  className,
  color = "currentColor",
  flip,
}: Props) {
  return (
    <svg
      viewBox="0 0 100 140"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ color, transform: flip ? "scaleX(-1)" : undefined }}
    >
      {/* head */}
      <circle cx="50" cy="14" r="10.5" fill="currentColor" />
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="9.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* torso */}
        <path d="M50 33c0 16-1 30-1 45" />
        {/* arms lifted in praise */}
        <path d="M46 40C37 34 26 22 20 8" />
        <path d="M54 40c9-6 20-18 26-32" />
        {/* legs mid-jump */}
        <path d="M49 78c-4 17-7 34-9 52" />
        <path d="M51 78c5 17 9 34 12 52" />
      </g>
    </svg>
  );
}
