import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LandingSlide } from "@/modules/media/types";

/** How long a slide is shown before the carousel rotates on its own. */
const ROTATION_EVERY_MS = 6_000;

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mql.matches);
    setReduced(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

function ArrowButton({
  Icon,
  label,
  onClick,
  className,
}: {
  Icon: React.ElementType;
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={cn(
        "absolute h-8 w-8 rounded-full top-1/2 -translate-y-1/2 z-20",
        className,
      )}
      onClick={onClick}
      aria-label={label}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </Button>
  );
}

export function HeroSlider({ slides }: { slides: LandingSlide[] }) {
  const { t } = useTranslation("landing");
  const [api, setApi] = useState<CarouselApi | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reducedMotion = useReducedMotion();

  const startRotation = useCallback(() => {
    if (reducedMotion || !api || slides.length <= 1) return;
    timerRef.current = setInterval(() => api.scrollNext(), ROTATION_EVERY_MS);
  }, [api, reducedMotion, slides.length]);

  const stopRotation = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // The rotation starts when the slider mounts and pauses while a pointer
  // rests on it; a member who prefers reduced motion never sees it rotate.
  useEffect(() => {
    startRotation();
    return () => stopRotation();
  }, [startRotation, stopRotation]);

  const onSelect = useCallback(() => {
    if (!api) return;
    setSelectedIndex(api.selectedScrollSnap());
    stopRotation();
    startRotation();
  }, [api, startRotation, stopRotation]);

  useEffect(() => {
    if (!api) return;
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api, onSelect]);

  return (
    <Carousel
      setApi={setApi}
      opts={{ loop: true }}
      onPointerEnter={stopRotation}
      onPointerLeave={startRotation}
    >
      <CarouselContent>
        {slides.map((slide) => (
          <CarouselItem key={slide.id}>
            <img
              src={slide.image}
              alt={slide.title ?? t("hero.imageAlt")}
              width={1200}
              height={912}
              className="w-full h-full object-cover"
              loading="eager"
              decoding="async"
            />
          </CarouselItem>
        ))}
      </CarouselContent>

      <ArrowButton
        Icon={ArrowLeft}
        label={t("slider.previous")}
        className="inset-start-0"
        onClick={() => {
          api?.scrollPrev();
          stopRotation();
          startRotation();
        }}
      />
      <ArrowButton
        Icon={ArrowRight}
        label={t("slider.next")}
        className="inset-end-0"
        onClick={() => {
          api?.scrollNext();
          stopRotation();
          startRotation();
        }}
      />

      {slides.length > 1 && (
        <div
          className="absolute bottom-4 start-1/2 -translate-x-1/2 flex gap-2 z-20"
          role="tablist"
          aria-label={t("slider.control")}
        >
          {slides.map((_, index) => (
            <Button
              key={index}
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-8 rounded-full"
              role="tab"
              aria-selected={selectedIndex === index}
              aria-label={t("slider.slide", {
                index: index + 1,
                total: slides.length,
              })}
              onClick={() => {
                api?.scrollTo(index);
                stopRotation();
                startRotation();
              }}
            >
              <span className="sr-only">
                {t("slider.slide", {
                  index: index + 1,
                  total: slides.length,
                })}
              </span>
            </Button>
          ))}
        </div>
      )}
    </Carousel>
  );
}
