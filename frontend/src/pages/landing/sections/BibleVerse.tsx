import { Quote, Church } from "lucide-react";

export function BibleVerse() {
  return (
    <section id="gallery" className="bg-soft py-14 lg:py-16">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 lg:grid-cols-3 lg:px-8">
        <figure className="reveal flex gap-3">
          <Quote
            className="h-7 w-7 shrink-0 fill-mint text-mint"
            aria-hidden="true"
          />
          <div>
            <blockquote className="text-[15px] font-medium italic leading-7 text-brand-blue">
              Don't let anyone look down on you because you are young, but set
              an example for the believers in speech, in life, in love, in faith
              and in purity.
            </blockquote>
            <figcaption className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-mint">
              1 Timothy 4:12
            </figcaption>
          </div>
        </figure>

        <div className="flex justify-center">
          <span className="grid h-32 w-32 place-items-center rounded-full bg-navy text-white">
            <Church className="h-16 w-16" aria-hidden="true" />
          </span>
        </div>

        <div className="reveal">
          <h2 className="text-xl font-extrabold tracking-tight text-navy">
            COME AS YOU ARE
          </h2>
          <p className="mt-3 text-[15px] leading-7 text-muted-foreground">
            No perfect people allowed!
            <br />
            Just real hearts seeking a real God.
          </p>
          <p className="mt-3 text-[15px] font-extrabold text-brand-blue">
            WE CAN'T WAIT TO MEET YOU!
          </p>
        </div>
      </div>
    </section>
  );
}
