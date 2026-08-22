/**
 * Mint corner brackets + animated scan line overlay for the camera
 * viewport. Purely decorative; the scan line is disabled under
 * prefers-reduced-motion (Design-Guide §17).
 */
export function ScannerFrame() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {/* corner brackets: 28px arms, 3px stroke */}
      <span className="absolute left-6 top-6 h-7 w-7 rounded-tl-md border-s-[3px] border-t-[3px] border-mint" />
      <span className="absolute right-6 top-6 h-7 w-7 rounded-tr-md border-e-[3px] border-t-[3px] border-mint" />
      <span className="absolute bottom-6 left-6 h-7 w-7 rounded-bl-md border-b-[3px] border-s-[3px] border-mint" />
      <span className="absolute bottom-6 right-6 h-7 w-7 rounded-br-md border-b-[3px] border-e-[3px] border-mint" />

      {/* scan line: 2s ease-in-out sweep, disabled by reduced motion */}
      <div className="scanner-line absolute inset-x-8 top-10 h-0.5 rounded-full bg-brand-red/80" />
    </div>
  );
}
