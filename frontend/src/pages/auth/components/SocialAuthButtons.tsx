import { useLanguage } from "@/i18n/context";
import { googleSignInUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

interface SocialAuthButtonsProps {
  googleLabel: string;
  comingSoonLabel: string;
}

/**
 * "Continue with Google" via the backend's OAuth redirect flow:
 * the anchor sends the browser to GET /api/v1/auth/google/login, which
 * redirects to Google and later back to /google/callback on this app.
 * No popup, so no popup-blocker or third-party-cookie problems.
 */
export function SocialAuthButtons({
  googleLabel,
  comingSoonLabel,
}: SocialAuthButtonsProps) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  const { language } = useLanguage();
  const isArabic = language === "ar";

  if (!clientId) {
    return (
      <button
        type="button"
        disabled
        title={comingSoonLabel}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-lg font-medium text-ink transition-colors hover:bg-soft focus-ring disabled:cursor-not-allowed disabled:opacity-60"
      >
        <GoogleGlyph />
        {googleLabel}
      </button>
    );
  }

  return (
    <a
      href={googleSignInUrl()}
      aria-label={googleLabel}
      className={cn(
        "focus-ring flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-lg font-medium text-ink transition-colors hover:bg-soft",
        isArabic ? "font-arabic" : "",
      )}
    >
      <GoogleGlyph />
      {googleLabel}
    </a>
  );
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.9-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1 .7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.7-4.9H1.3v3.1A11.9 11.9 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.3 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.3a12 12 0 0 0 0 10.7l4-3Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.3.6 4.5 1.8l3.4-3.4A11.5 11.5 0 0 0 12 0 11.9 11.9 0 0 0 1.3 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z"
      />
    </svg>
  );
}
