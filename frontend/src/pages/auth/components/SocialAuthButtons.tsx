const socials = [
  { id: "google", labelKey: "google" as const },
  { id: "facebook", labelKey: "facebook" as const },
] as const;

interface SocialAuthButtonsProps {
  googleLabel: string;
  facebookLabel: string;
  comingSoonLabel: string;
}

/**
 * OAuth is not implemented on the backend yet, so these render as clean
 * UI placeholders. The integration point is isolated here: when the backend
 * exposes OAuth endpoints, replace the onClick handlers with real navigation.
 */
export function SocialAuthButtons({
  googleLabel,
  facebookLabel,
  comingSoonLabel,
}: SocialAuthButtonsProps) {
  return (
    <div className="space-y-3">
      {socials.map(({ id, labelKey }) => (
        <button
          key={id}
          type="button"
          disabled
          title={comingSoonLabel}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-lg font-medium text-navy transition-colors hover:bg-soft focus-ring disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span
            aria-hidden="true"
            className="grid h-5 w-5 place-items-center rounded-full bg-navy text-[10px] font-bold text-white"
          >
            {id === "google" ? "G" : "f"}
          </span>
          {labelKey === "google" ? googleLabel : facebookLabel}
        </button>
      ))}
    </div>
  );
}
