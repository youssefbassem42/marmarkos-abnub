import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import { useLanguage } from "@/i18n/context";
import { Toaster } from "@/components/ui/sonner";
import { router } from "@/router";

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
  const { language } = useLanguage();
  return (
    <Toaster position="top-center" dir={language === "ar" ? "rtl" : "ltr"} />
  );
}

export function AppProviders() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AppToaster />
        <RouterProvider router={router} />
      </LanguageProvider>
    </QueryClientProvider>
  );
}
