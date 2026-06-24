import { useLang } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Gift, ShieldCheck, Zap } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const AUTO_MS = 4500;

export default function HeroCarousel() {
  const { lang, t } = useLang();
  const { data: banners, isLoading } = trpc.site.banners.useQuery();
  const [index, setIndex] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const count = banners?.length ?? 0;

  const go = useCallback(
    (next: number) => {
      if (count === 0) return;
      setIndex(((next % count) + count) % count);
    },
    [count],
  );

  // Auto-advance one slide at a time. Pauses naturally on re-render reset.
  useEffect(() => {
    if (count <= 1) return;
    timer.current = setInterval(() => setIndex(i => (i + 1) % count), AUTO_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [count]);

  if (isLoading) return <Skeleton className="h-44 w-full rounded-3xl" />;

  if (count === 0) {
    // Fallback hero when no banners configured yet
    return (
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/25 via-accent/15 to-transparent p-5">
        <div className="absolute -right-8 -top-10 size-40 rounded-full bg-primary/30 blur-3xl" />
        <div className="relative">
          <h1 className="font-display text-2xl font-extrabold leading-tight">{t("home.heroTitle")}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{t("home.heroSub")}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="relative">
      <div className="relative overflow-hidden rounded-3xl border border-border">
        {/* Track */}
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {banners!.map(b => {
            const title = lang === "my" && b.titleMy ? b.titleMy : b.title;
            const subtitle = lang === "my" && b.subtitleMy ? b.subtitleMy : b.subtitle;
            return (
              <div key={b.id} className="relative w-full shrink-0">
                <div
                  className="relative min-h-[11rem] p-5"
                  style={
                    b.imageUrl
                      ? { backgroundImage: `url(${b.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
                      : { background: `linear-gradient(125deg, ${b.colorFrom}, ${b.colorTo})` }
                  }
                >
                  {/* Readability overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
                  <div className="absolute -right-8 -top-10 size-40 rounded-full bg-white/15 blur-3xl" />
                  <div className="relative">
                    {b.badge && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur">
                        <Gift className="size-3" /> {b.badge}
                      </span>
                    )}
                    <h1 className="mt-3 max-w-[85%] font-display text-2xl font-extrabold leading-tight text-white drop-shadow">
                      {title}
                    </h1>
                    {subtitle && <p className="mt-1.5 max-w-[90%] text-sm text-white/85">{subtitle}</p>}
                    <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-white/80">
                      <span className="flex items-center gap-1">
                        <Zap className="size-3.5" /> Fast delivery
                      </span>
                      <span className="flex items-center gap-1">
                        <ShieldCheck className="size-3.5" /> Secure payment
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Arrows (only when multiple) */}
        {count > 1 && (
          <>
            <button
              onClick={() => go(index - 1)}
              aria-label="Previous"
              className="press absolute left-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-black/35 text-white backdrop-blur transition hover:bg-black/55"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              onClick={() => go(index + 1)}
              aria-label="Next"
              className="press absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-black/35 text-white backdrop-blur transition hover:bg-black/55"
            >
              <ChevronRight className="size-4" />
            </button>
          </>
        )}
      </div>

      {/* Dots */}
      {count > 1 && (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {banners!.map((_, i) => (
            <button
              key={i}
              onClick={() => go(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === index ? "w-6 bg-primary" : "w-1.5 bg-border"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
