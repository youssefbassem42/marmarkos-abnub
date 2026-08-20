import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "./sections/Hero";
import { Pillars } from "./sections/Pillars";
import { About } from "./sections/About";
import { UpcomingService } from "./sections/UpcomingService";
import { BibleVerse } from "./sections/BibleVerse";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";

export function LandingPage() {
  useScrollReveal();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Hero />
        <Pillars />
        <About />
        <UpcomingService />
        <BibleVerse />
      </main>
      <Footer />
    </div>
  );
}
