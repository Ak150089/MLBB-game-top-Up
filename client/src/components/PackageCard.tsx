import { cn } from "@/lib/utils";
import { formatKs } from "@/contexts/LanguageContext";
import { Check } from "lucide-react";
import { useState } from "react";
import type { Package } from "@shared/types";

const MLBB_BASE = "https://shineaker-uploads.sgp1.digitaloceanspaces.com/mlbb";
const PUBG_BASE = "https://shineaker-uploads.sgp1.digitaloceanspaces.com/pubg";
const TG_BASE = "https://shineaker-uploads.sgp1.digitaloceanspaces.com/telegram";

function getImage(label: string): string | null {
  const l = label.toLowerCase();
  // Telegram Premium
  if (l.includes("premium") && l.includes("12")) return `${TG_BASE}/premium-12m.webp`;
  if (l.includes("premium") && l.includes("6"))  return `${TG_BASE}/premium-6m.webp`;
  if (l.includes("premium") && l.includes("3"))  return `${TG_BASE}/premium-3m.webp`;
  if (l.includes("premium")) return `${TG_BASE}/premium-3m.webp`;
  // Telegram Stars
  if (l.includes("star")) return `${TG_BASE}/stars.webp`;
  if (l.includes("uc")) {
    const amt = parseInt(label.replace(/[^0-9]/g, "")) || 0;
    if (amt >= 1320) return `${PUBG_BASE}/large.webp`;
    if (amt >= 180)  return `${PUBG_BASE}/medium.webp`;
    return `${PUBG_BASE}/small.webp`;
  }
  if (l.includes("twilight")) return `${MLBB_BASE}/twilight.webp`;
  if (l.includes("lukas") || l.includes("magic chess") || l.includes("chess")) return `${MLBB_BASE}/lukas.webp`;
  if (l.includes("weekly") || l.includes("14 day") || l.includes("pass")) return `${MLBB_BASE}/weekly.webp`;
  if (l.includes("diamond")) {
    const amt = parseInt(label.replace(/[^0-9]/g, "")) || 0;
    if (amt >= 5000) return `${MLBB_BASE}/bank.webp`;
    if (amt >= 2000) return `${MLBB_BASE}/car.webp`;
    if (amt >= 1000) return `${MLBB_BASE}/safe.webp`;
    if (amt >= 500)  return `${MLBB_BASE}/openbox.webp`;
    if (amt >= 100)  return `${MLBB_BASE}/pile.webp`;
    return `${MLBB_BASE}/diamond.webp`;
  }
  return null;
}

function getEmoji(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("uc")) return "🪙";
  if (l.includes("twilight")) return "🌅";
  if (l.includes("weekly") || l.includes("pass")) return "📅";
  return "💎";
}

function stripEmoji(label: string): string {
  return label.replace(/[^\w\s\-().,: ]/g, "").trim();
}

interface Props {
  pkg: Package;
  active: boolean;
  onClick: () => void;
}

export default function PackageCard({ pkg, active, onClick }: Props) {
  const [ok, setOk] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [hover, setHover] = useState(false);
  const img = getImage(pkg.label);
  const emoji = getEmoji(pkg.label);
  const sweeping = hover || active;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={cn(
        "press group relative flex flex-col overflow-hidden rounded-2xl border bg-card transition-all duration-200",
        active
          ? "border-primary shadow-lg shadow-primary/30 scale-[1.02]"
          : "border-border hover:-translate-y-1 hover:border-primary/60 hover:shadow-lg hover:shadow-primary/20",
      )}
    >
      <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden bg-white">
        {img && ok ? (
          <>
            {!loaded && (
              <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200" />
            )}
            <img
              src={img}
              alt={pkg.label}
              onLoad={() => setLoaded(true)}
              onError={() => setOk(false)}
              className={cn(
                "h-full w-full object-cover transition-all duration-300 group-hover:scale-110",
                loaded ? "scale-100 opacity-100" : "scale-105 opacity-0",
              )}
              crossOrigin="anonymous"
            />

            {/* Shimmer sweep overlay */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div
                className="absolute top-0 h-[160%] w-2/5 rotate-[8deg] bg-gradient-to-r from-transparent via-white/35 to-transparent"
                style={{
                  left: sweeping ? "120%" : "-60%",
                  transition: sweeping ? "left 0.9s cubic-bezier(.4,0,.2,1)" : "none",
                }}
              />
            </div>
          </>
        ) : (
          <span className="text-4xl">{emoji}</span>
        )}

        {pkg.isPopular && (
          <span className="absolute left-1.5 top-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-2 py-0.5 text-[8px] font-black uppercase tracking-wide text-white shadow">
            Best
          </span>
        )}
        {active && (
          <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-white shadow-lg">
            <Check className="size-3" strokeWidth={3} />
          </span>
        )}
      </div>

      <div className={cn(
        "flex w-full flex-col gap-0.5 px-2 py-2 transition-colors duration-200",
        active ? "bg-primary/15" : "bg-card group-hover:bg-primary/[0.06]",
      )}>
        <span className="line-clamp-1 text-left text-[11px] font-bold text-foreground">
          {stripEmoji(pkg.label ?? "")}
        </span>
        <span className={cn(
          "text-left text-xs font-extrabold",
          active ? "text-primary" : "text-primary/90",
        )}>
          {formatKs(pkg.priceKs ?? 0)}
        </span>
      </div>
    </button>
  );
}
