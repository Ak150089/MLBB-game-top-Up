import { useLang } from "@/contexts/LanguageContext";
import type { Product } from "@shared/types";
import { Zap } from "lucide-react";
import { Link } from "wouter";

export default function ProductCard({ product }: { product: Product }) {
  const { t } = useLang();
  return (
    <Link
      href={`/product/${product.slug}`}
      className="press group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-lg hover:shadow-primary/10"
    >
      <div
        className="relative aspect-square w-full overflow-hidden"
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
          <div className="grid size-full place-items-center p-3 text-center">
            <span className="font-display text-lg font-extrabold leading-tight text-white drop-shadow">
              {product.name}
            </span>
          </div>
        )}
        {product.topupCount > 0 && (
          <span className="absolute left-1.5 top-1.5 rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
            {new Intl.NumberFormat("en-US").format(product.topupCount)}+
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-1 p-2.5">
        <span className="truncate text-sm font-semibold">{product.name}</span>
        <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
          <Zap className="size-3" />
          {t("home.topup")}
        </span>
      </div>
    </Link>
  );
}
