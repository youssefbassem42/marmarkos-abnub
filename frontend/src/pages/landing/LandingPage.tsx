import { useEffect } from "react";
import { useLocation } from "react-router-dom";
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

  // A link that carries an anchor lands on the section it names: the quick
  // links of the footer point at the sections of this page from every page
  // of the platform, and the member has to arrive at the section, not at the
  // top of the page.
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const target = document.getElementById(hash.slice(1));
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hash]);

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
