import { Navbar } from "@/components/layout/Navbar";
import { AuthFooter } from "../components/AuthFooter";
import { BrandPanel } from "../components/BrandPanel";
import { RegistrationCard } from "./RegistrationCard";

export function RegisterPage() {
  return (
    <div
      dir="rtl"
      lang="ar"
      className="min-h-screen bg-background"
    >
      <Navbar variant="auth" />

      <main className="flex min-h-[calc(100vh-61px)] flex-col lg:flex-row">
        <BrandPanel lang="ar" />
        <RegistrationCard lang="ar" />
      </main>

      <AuthFooter lang="ar" />
    </div>
  );
}
