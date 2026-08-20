type Props = {
  className?: string;
  color?: string;
  flip?: boolean;
};

/** Decorative raised-arms youth silhouette inspired by the church logo. */
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
      <g fill="currentColor">
        <circle cx="50" cy="20" r="13" />
        <path d="M50 35c11 0 17 7 19 15l8 26c1.6 5-5.6 8-7.6 3L64 62l-2 20 9 46c1.4 6-7.4 8.6-9.4 2.6L52 96l-9 34.6c-1.8 6-10.8 3.4-9.4-2.6l9-46-2-20-5.4 17c-2 5-9.2 2-7.6-3l8-26c2-8 8-15 19-15Z" />
        <path d="M31 38 12 12c-3-4 3.6-8.6 6.6-4.6L38 32Z" />
        <path d="M69 38 88 12c3-4-3.6-8.6-6.6-4.6L62 32Z" />
      </g>
    </svg>
  );
}
