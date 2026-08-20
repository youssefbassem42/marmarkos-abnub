import {
  MapPin,
  Phone,
  Mail,
  Facebook,
  Instagram,
  Youtube,
  Heart,
} from "lucide-react";
import logo from "@/assets/church-logo.png";

const quick = ["Home", "About", "Ministries", "Events", "Gallery", "Contact"];
const ministries = [
  "Worship",
  "Small Groups",
  "Outreach",
  "Discipleship",
  "Events",
];

const socials = [
  { Icon: Facebook, label: "Facebook" },
  { Icon: Instagram, label: "Instagram" },
  { Icon: Youtube, label: "YouTube" },
];

export function Footer() {
  return (
    <footer id="contact" className="bg-navy text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,1fr))] lg:px-8">
        <div>
          <img
            src={logo}
            alt="إجتماع الشباب بأبنوب church logo"
            width={160}
            height={112}
            loading="lazy"
            className="h-24 w-auto brightness-0 invert"
          />
          <p
            dir="rtl"
            lang="ar"
            className="font-arabic mt-3 w-fit text-lg font-bold"
          >
            إجتماع الشباب بأبنوب
          </p>
        </div>

        <nav aria-label="Quick links">
          <h2 className="text-sm font-extrabold uppercase tracking-[0.12em]">
            Quick Links
          </h2>
          <ul className="mt-4 space-y-2 text-sm text-white/75">
            {quick.map((l) => (
              <li key={l}>
                <a
                  href={`#${l.toLowerCase()}`}
                  className="focus-ring rounded-sm hover:text-mint"
                >
                  {l}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Ministries">
          <h2 className="text-sm font-extrabold uppercase tracking-[0.12em]">
            Ministries
          </h2>
          <ul className="mt-4 space-y-2 text-sm text-white/75">
            {ministries.map((l) => (
              <li key={l}>
                <a
                  href="#ministries"
                  className="focus-ring rounded-sm hover:text-mint"
                >
                  {l}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="text-sm font-extrabold uppercase tracking-[0.12em]">
            Contact Us
          </h2>
          <ul className="mt-4 space-y-3 text-sm text-white/75">
            <li className="flex gap-3">
              <MapPin
                className="mt-0.5 h-4 w-4 shrink-0 text-mint"
                aria-hidden="true"
              />
              <span>
                Your Church Name
                <br />
                Your City, Country
              </span>
            </li>
            <li className="flex items-center gap-3">
              <Phone
                className="h-4 w-4 shrink-0 text-mint"
                aria-hidden="true"
              />
              <a
                href="tel:+201234567890"
                className="focus-ring rounded-sm hover:text-mint"
              >
                +20 123 456 7890
              </a>
            </li>
            <li className="flex items-center gap-3">
              <Mail className="h-4 w-4 shrink-0 text-mint" aria-hidden="true" />
              <a
                href="mailto:youth@churchname.org"
                className="focus-ring rounded-sm hover:text-mint"
              >
                youth@churchname.org
              </a>
            </li>
          </ul>
          <ul className="mt-5 flex gap-3">
            {socials.map(({ Icon, label }) => (
              <li key={label}>
                <a
                  href="#contact"
                  aria-label={label}
                  className="focus-ring grid h-9 w-9 place-items-center rounded-full bg-white/12 transition-colors hover:bg-mint"
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/12">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-5 text-xs text-white/65 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <p>© 2026 Your Church Name. All rights reserved.</p>
          <p className="inline-flex items-center gap-1.5">
            Made with{" "}
            <Heart
              className="h-3.5 w-3.5 fill-brand-red text-brand-red"
              aria-hidden="true"
            />{" "}
            for God's glory
          </p>
        </div>
      </div>
    </footer>
  );
}
