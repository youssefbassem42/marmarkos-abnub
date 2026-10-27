import { Navbar } from "@/components/layout/Navbar";
import { AuthFooter } from "../components/AuthFooter";
import { BrandPanel } from "../components/BrandPanel";
import { AuthCard } from "./AuthCard";

export function LoginPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar variant="auth" />

      <main className="flex min-h-[calc(100vh-61px)] flex-col lg:flex-row">
        <BrandPanel />
        <AuthCard />
      </main>

      <AuthFooter />
    </div>
  );
}
