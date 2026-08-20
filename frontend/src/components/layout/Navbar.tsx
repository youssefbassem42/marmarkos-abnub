import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import logo from "@/assets/church-logo.png";

const links = [
  { label: "Home", href: "#home" },
  { label: "About", href: "#about" },
  { label: "Ministries", href: "#ministries" },
  { label: "Events", href: "#events" },
  { label: "Gallery", href: "#gallery" },
  { label: "Contact", href: "#contact" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 bg-background transition-shadow duration-300 ${
        scrolled ? "shadow-[0_2px_18px_rgba(37,61,99,0.10)]" : ""
      }`}
    >
      <nav className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-3 lg:px-8">
        <a
          href="#home"
          className="flex min-w-0 items-center gap-2 focus-ring rounded-md"
        >
          <img
            src={logo}
            alt="إجتماع الشباب بأبنوب church logo"
            width={112}
            height={78}
            className="h-14 w-auto"
          />
          <span className="sr-only">إجتماع الشباب بأبنوب — Youth Service</span>
        </a>

        <div className="flex items-center gap-2">
          <ul className="hidden items-center gap-7 lg:flex">
            {links.map((l, i) => (
              <li key={l.label}>
                <a
                  href={l.href}
                  className={`focus-ring rounded-sm pb-1 text-[15px] font-medium transition-colors hover:text-brand-blue ${
                    i === 0
                      ? "border-b-2 border-brand-blue text-brand-blue"
                      : "text-navy"
                  }`}
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>

          <a
            href="#events"
            className="btn-primary ml-4 hidden px-6 py-2.5 text-sm sm:inline-flex"
          >
            Join Us
          </a>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            className="focus-ring inline-flex h-11 w-11 items-center justify-center rounded-xl text-navy lg:hidden"
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="border-t border-border bg-background lg:hidden">
          <ul className="mx-auto max-w-7xl px-5 py-3">
            {links.map((l) => (
              <li key={l.label}>
                <a
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="focus-ring block rounded-lg px-2 py-3 text-base font-medium text-navy hover:bg-secondary"
                >
                  {l.label}
                </a>
              </li>
            ))}
            <li className="pt-2 pb-4">
              <a
                href="#events"
                onClick={() => setOpen(false)}
                className="btn-primary w-full justify-center py-3"
              >
                Join Us
              </a>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
