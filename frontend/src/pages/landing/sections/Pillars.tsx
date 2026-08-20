import { BookOpen, Users, Heart, Flame } from "lucide-react";

const pillars = [
  {
    title: "GROWING IN FAITH",
    text: "We explore God's Word together and grow in our relationship with Him.",
    Icon: BookOpen,
    color: "var(--brand-mint)",
  },
  {
    title: "REAL FRIENDSHIPS",
    text: "Building a community where you belong and can be yourself.",
    Icon: Users,
    color: "var(--brand-blue)",
  },
  {
    title: "MAKING AN IMPACT",
    text: "Empowered by God to make a difference in our church and our world.",
    Icon: Heart,
    color: "var(--brand-orange)",
  },
  {
    title: "LIVING WITH PURPOSE",
    text: "Discovering the unique plan God has for your life and walking in it.",
    Icon: Flame,
    color: "var(--brand-red)",
  },
];

export function Pillars() {
  return (
    <section id="ministries" className="bg-soft py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="mx-auto flex max-w-xl items-center gap-5">
          <span className="h-px flex-1 bg-border" />
          <h2 className="text-center text-2xl font-extrabold tracking-tight text-navy lg:text-[28px]">
            WE ARE ABOUT
          </h2>
          <span className="h-px flex-1 bg-border" />
        </div>

        <ul className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
          {pillars.map(({ title, text, Icon, color }, i) => (
            <li
              key={title}
              className={`reveal flex flex-col items-center px-4 text-center lg:px-8 ${
                i > 0 ? "lg:border-l lg:border-border" : ""
              }`}
              style={{ transitionDelay: `${i * 90}ms` }}
            >
              <span
                className="grid h-[70px] w-[70px] shrink-0 place-items-center rounded-full text-white shadow-sm transition-transform duration-300 hover:-translate-y-1"
                style={{ backgroundColor: color }}
              >
                <Icon className="h-8 w-8" aria-hidden="true" />
              </span>
              <h3 className="mt-6 text-[15px] font-extrabold tracking-tight text-navy">
                {title}
              </h3>
              <p className="mt-3 max-w-[15rem] text-sm leading-6 text-muted-foreground">
                {text}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
