import { Check, ArrowRight } from "lucide-react";
import church from "@/assets/church-evening.jpg";
import { YouthFigure } from "./YouthFigure";

const items = [
  "Worship that's real",
  "Messages that speak to life",
  "Small groups & deep conversations",
  "Fun events & unforgettable memories",
];

export function About() {
  return (
    <section id="about" className="py-16 lg:py-20">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 lg:grid-cols-[minmax(0,42%)_minmax(0,58%)] lg:px-8">
        <div className="reveal">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-mint">
            Who we are
          </p>
          <h2 className="mt-3 text-[clamp(1.9rem,4vw,2.5rem)] font-extrabold tracking-tight text-navy">
            A PLACE FOR YOU
          </h2>
          <p className="mt-5 max-w-lg text-[15px] leading-7 text-muted-foreground">
            We are a group of young people passionate about Jesus and living out
            our faith together. Whether you're new to church or have been
            following Jesus for a while, there's a place for you here.
          </p>
          <ul className="mt-6 space-y-2.5">
            {items.map((item) => (
              <li key={item} className="flex items-center gap-3">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-mint text-white">
                  <Check
                    className="h-3 w-3"
                    strokeWidth={3}
                    aria-hidden="true"
                  />
                </span>
                <span className="text-sm text-navy">{item}</span>
              </li>
            ))}
          </ul>
          <a href="#contact" className="btn-primary mt-8 px-6 py-3.5 text-sm">
            MORE ABOUT US
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>

        <div className="relative reveal">
          <div className="overflow-hidden">
            <img
              src={church}
              alt="Young people gathered outside a warmly lit church in the evening"
              width={1200}
              height={912}
              loading="lazy"
              className="brush-mask w-full object-cover transition-transform duration-500 hover:scale-[1.03]"
            />
          </div>
          <YouthFigure
            className="absolute right-[1%] top-[6%] h-20 w-auto lg:h-24"
            color="var(--brand-mint)"
          />
          <YouthFigure
            className="absolute right-[-1%] top-[36%] h-20 w-auto lg:h-24"
            color="var(--brand-blue)"
            flip
          />
          <YouthFigure
            className="absolute right-[6%] bottom-[-4%] h-20 w-auto lg:h-24"
            color="var(--brand-red)"
          />
        </div>
      </div>
    </section>
  );
}
