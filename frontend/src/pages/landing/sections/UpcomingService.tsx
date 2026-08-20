import { CalendarDays, Clock, MapPin, ArrowRight } from "lucide-react";

export function UpcomingService() {
  return (
    <section id="events" className="bg-navy py-14 text-white lg:py-16">
      <div className="mx-auto grid max-w-7xl items-center gap-8 px-5 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:gap-10 lg:px-8">
        <span className="grid h-24 w-24 shrink-0 place-items-center rounded-full bg-white text-navy shadow-lg lg:h-28 lg:w-28">
          <CalendarDays className="h-12 w-12" aria-hidden="true" />
        </span>

        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-mint">
            Upcoming Service
          </p>
          <h2 className="mt-2 text-[clamp(1.7rem,4vw,2.2rem)] font-extrabold tracking-tight">
            FRIDAY YOUTH NIGHT
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[15px]">
            <span className="inline-flex items-center gap-2">
              <Clock className="h-4 w-4 text-mint" aria-hidden="true" /> 7:00 PM
            </span>
            <span className="hidden h-5 w-px bg-white/25 sm:block" />
            <span className="inline-flex items-center gap-2">
              <MapPin className="h-4 w-4 text-mint" aria-hidden="true" /> Church
              Hall
            </span>
          </div>
          <p className="mt-4 text-sm leading-6 text-white/85">
            Worship. Word. Fellowship.
            <br />
            You don't want to miss it!
          </p>
        </div>

        <a
          href="#contact"
          className="focus-ring inline-flex items-center justify-center gap-3 rounded-xl bg-mint px-7 py-3.5 text-sm font-bold text-white transition-transform duration-200 hover:-translate-y-0.5"
        >
          I'LL BE THERE!
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}
