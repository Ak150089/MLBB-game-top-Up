import HeroCarousel from "@/components/HeroCarousel";
import PremiumCard from "@/components/PremiumCard";
import ProductCard from "@/components/ProductCard";
import StoreLayout from "@/components/StoreLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { useLang } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import type { Product } from "@shared/types";
import { Crown, Flame, Sparkles } from "lucide-react";
import { useSearch } from "wouter";

export default function Home() {
  const { t } = useLang();
  const { data: products, isLoading } = trpc.catalog.products.useQuery();

  const grouped = (products ?? []).reduce<Record<string, Product[]>>((acc, p) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  }, {});

  const popular = grouped["popular"] ?? [];
  const premium = grouped["premium"] ?? [];
  const other = grouped["other"] ?? [];

  // ?cat= filter
  const search = useSearch();
  const cat = new URLSearchParams(search).get("cat");
  const showPopular = !cat || cat === "popular";
  const showPremium = !cat || cat === "premium";
  const showOther = !cat || cat === "other";

  return (
    <StoreLayout>
      <HeroCarousel />

      {isLoading ? (
        <div className="mt-6 space-y-6">
          {[0, 1].map(i => (
            <div key={i}>
              <Skeleton className="mb-3 h-5 w-32" />
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                {[0, 1, 2].map(j => (
                  <Skeleton key={j} className="aspect-[3/4] rounded-2xl" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {/* Popular Games */}
          {showPopular && popular.length > 0 && (
            <section>
              <SectionHeader icon={<Flame className="size-4 text-primary" />} title={t("cat.popular")} />
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                {popular.map(p => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </section>
          )}

          {/* Premium Apps — distinct premium vibe */}
          {showPremium && premium.length > 0 && (
            <section className="relative overflow-hidden rounded-3xl border border-gold/20 bg-gradient-to-b from-gold/[0.06] to-transparent p-4">
              <div className="pointer-events-none absolute -left-10 -top-10 size-32 rounded-full bg-gold/10 blur-3xl" />
              <div className="relative mb-3 flex items-center gap-2">
                <Crown className="size-4 text-gold" />
                <h2 className="font-display text-lg font-bold">
                  <span className="text-gold">{t("cat.premium")}</span>
                </h2>
              </div>
              <div className="relative grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {premium.map(p => (
                  <PremiumCard key={p.id} product={p} />
                ))}
              </div>
            </section>
          )}

          {/* Other Games */}
          {other.length > 0 && (
            <section>
              <SectionHeader icon={<Sparkles className="size-4 text-accent" />} title={t("cat.other")} />
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                {other.map(p => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </section>
          )}

          {(products?.length ?? 0) === 0 && (
            <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
              No products yet. Add some from the admin panel.
            </div>
          )}
        </div>
      )}
    </StoreLayout>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="grid size-7 place-items-center rounded-lg bg-secondary/60">{icon}</span>
      <h2 className="font-display text-lg font-bold">{title}</h2>
    </div>
  );
}
