import { useEffect, useRef } from "react";
import { useLanguage } from "@/i18n/context";

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleAccountsId {
  initialize: (config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
  }) => void;
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } };
  }
}

const GOOGLE_GSI_SRC = "https://accounts.google.com/gsi/client";
let gsiScriptPromise: Promise<void> | null = null;
const gsiInitialized = new Set<string>();

/** Load the Google Identity Services script once per page. */
function loadGoogleIdentityServices(): Promise<void> {
  if (!gsiScriptPromise) {
    gsiScriptPromise = new Promise((resolve, reject) => {
      if (window.google?.accounts?.id) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = GOOGLE_GSI_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Google script"));
      document.head.appendChild(script);
    });
  }
  return gsiScriptPromise;
}

interface SocialAuthButtonsProps {
  googleLabel: string;
  comingSoonLabel: string;
  /** Receives the Google ID token after the user completes the Google flow. */
  onCredential: (credential: string) => void;
}

export function SocialAuthButtons({
  googleLabel,
  comingSoonLabel,
  onCredential,
}: SocialAuthButtonsProps) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  const { language } = useLanguage();

  // Always call the latest handler without re-rendering the Google button.
  const onCredentialRef = useRef(onCredential);
  useEffect(() => {
    onCredentialRef.current = onCredential;
  }, [onCredential]);

  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize Google once per client ID; re-render the button on locale change.
  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    loadGoogleIdentityServices()
      .then(() => {
        const container = containerRef.current;
        const id = window.google?.accounts?.id;
        if (cancelled || !container || !id) return;

        if (!gsiInitialized.has(clientId)) {
          id.initialize({
            client_id: clientId,
            callback: (response) => {
              if (response.credential) {
                onCredentialRef.current(response.credential);
              }
            },
          });
          gsiInitialized.add(clientId);
        }
        container.innerHTML = "";
        id.renderButton(container, {
          size: "large",
          shape: "pill",
          width: 320,
          locale: language === "ar" ? "ar" : "en",
        });
      })
      .catch(() => {
        /* Script blocked; the disabled fallback styling stays. */
      });

    return () => {
      cancelled = true;
    };
  }, [clientId, language]);

  if (!clientId) {
    return (
      <button
        type="button"
        disabled
        title={comingSoonLabel}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-lg font-medium text-navy transition-colors hover:bg-soft focus-ring disabled:cursor-not-allowed disabled:opacity-60"
      >
        <GoogleGlyph />
        {googleLabel}
      </button>
    );
  }

  return (
    <div
      aria-label={googleLabel}
      className="relative flex w-full items-center justify-center rounded-xl border border-border bg-background px-4 py-3 text-lg font-medium text-navy transition-colors hover:bg-soft focus-within:ring-2 focus-within:ring-mint/60"
    >
      <span className="pointer-events-none flex items-center gap-2">
        <GoogleGlyph />
        {googleLabel}
      </span>
      {/* The real Google button is rendered invisibly on top so clicks open the official popup while our branding stays visible. */}
      <div
        ref={containerRef}
        className="absolute inset-0 overflow-hidden opacity-0"
      />
    </div>
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
