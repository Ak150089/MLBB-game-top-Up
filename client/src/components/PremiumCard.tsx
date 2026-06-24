import { useLang } from "@/contexts/LanguageContext";
import type { Product } from "@shared/types";
import { Crown, ChevronRight } from "lucide-react";
import { Link } from "wouter";

/**
 * Premium subscription-style card (Yuzumi-inspired): wide horizontal layout,
 * gold accents, "Premium" crown badge, and a clear CTA chevron.
 */
export default function PremiumCard({ product }: { product: Product }) {
  const { t } = useLang();
  return (
    <Link
      href={`/product/${product.slug}`}
      className="press group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-gold/25 bg-gradient-to-r from-card to-card/40 p-2.5 transition-shadow hover:shadow-lg hover:shadow-gold/10"
    >
      {/* Soft gold glow */}
      <div className="pointer-events-none absolute -right-6 -top-8 size-24 rounded-full bg-gold/15 blur-2xl" />
      <div
        className="relative size-16 shrink-0 overflow-hidden rounded-xl"
        style={{
          background: product.imageUrl
            ? undefined
            : `linear-gradient(140deg, ${product.color}, oklch(0.25 0.05 295))`,
        }}
      >
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="grid size-full place-items-center p-1 text-center">
            <span className="font-display text-xs font-extrabold leading-tight text-white drop-shadow">
              {product.name}
            </span>
          </div>
        )}
      </div>
      <div className="relative min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-display text-sm font-bold">{product.name}</span>
          <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-gold/15 px-1.5 py-0.5 text-[9px] font-bold text-gold">
            <Crown className="size-2.5" /> PREMIUM
          </span>
        </div>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {product.description || t("premium.tagline")}
        </p>
      </div>
      <ChevronRight className="relative size-4 shrink-0 text-gold/70 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
