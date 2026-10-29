import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import i18n from "@/i18n";

import { Toaster } from "@/components/ui/sonner";
import { router, FocusAfterNavigation } from "@/router";
import { restoreSession } from "@/lib/session";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
    },
  },
});

/** Toasts carry secondary feedback only; direction follows the language. */
function AppToaster() {
  return <Toaster position="top-center" dir={i18n.dir()} />;
}

/**
 * The start-up screen.
 *
 * It is shown while the session is restored (SEC-004): with the memory
 * persistence the router may only render once the access token is known,
 * otherwise the route guard would bounce a signed-in member to the login
 * page on every reload.
 */
function BootScreen() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-background"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="size-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
        <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>
      </div>
    </div>
  );
}

export function AppProviders() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void restoreSession().finally(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return <BootScreen />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AppToaster />
        <RouterProvider router={router} />
        <FocusAfterNavigation />
      </LanguageProvider>
    </QueryClientProvider>
  );
}
