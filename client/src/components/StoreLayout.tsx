import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { useLang } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Gamepad2, HeadphonesIcon, History, Home, LogOut, MessageCircle, Shield, Sparkles, Trophy, User, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";

function LangToggle() {
  const { lang, toggle } = useLang();
  return (
    <button
      onClick={toggle}
      className="press rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-xs font-semibold text-secondary-foreground"
      aria-label="Toggle language"
    >
      {lang === "en" ? "မြန်မာ" : "EN"}
    </button>
  );
}

const navItems = [
  { path: "/", key: "nav.home", icon: Home },
  { path: "/balance", key: "nav.wallet", icon: Wallet },
  { path: "/orders", key: "nav.history", icon: History },
  { path: "/spin", key: "nav.spin", icon: Sparkles },
  { path: "/leaderboard", key: "nav.leaderboard", icon: Trophy },
];

function BrandLogo() {
  const { data } = trpc.site.settings.useQuery();
  const brandName = data?.brandName || "ShineAker";
  // Split brand into two parts for the gradient accent on the trailing word
  const parts = brandName.split(/(?=[A-Z])|[-\s]/).filter(Boolean);
  const head = parts.length > 1 ? parts.slice(0, -1).join("") : brandName;
  const tail = parts.length > 1 ? parts[parts.length - 1] : "";

  return (
    <Link href="/" className="flex items-center gap-2">
      {data?.logoUrl ? (
        <img src={data.logoUrl} alt={brandName} className="size-8 lg:size-10 rounded-xl object-cover glow-primary" />
      ) : (
        <span className="grid size-8 lg:size-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent font-bold text-white glow-primary">
          <Gamepad2 className="size-4" />
        </span>
      )}
      <span className="font-display text-base font-extrabold tracking-tight">
        {tail ? (
          <>
            {head}
            <span className="text-gradient">{tail}</span>
          </>
        ) : (
          <span className="text-gradient">{brandName}</span>
        )}
      </span>
    </Link>
  );
}

function StoreFooter() {
  const { data } = trpc.site.settings.useQuery();
  const brandName = data?.brandName || "ShineAker";
  const email = data?.contactEmail || "shineaker@gmail.com";
  const year = new Date().getFullYear();
  return (
    <footer className="mx-auto w-full px-4 pb-24 pt-2">
      <div className="rounded-2xl border border-border bg-card/40 px-4 py-5 text-center">
        <div className="flex items-center justify-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-primary to-accent text-white">
            <Gamepad2 className="size-3.5" />
          </span>
          <span className="font-display text-sm font-extrabold">{brandName}</span>
        </div>
        <a
          href={`mailto:${email}`}
          className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
        >
          {email}
        </a>
        <p className="mt-2 text-[11px] text-muted-foreground">
          © {year} {brandName}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

export default function StoreLayout({ children }: { children: ReactNode }) {
  const { t } = useLang();
  const { user, isAuthenticated, logout } = useAuth();
  const [location] = useLocation();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 items-center justify-between px-4">
          <BrandLogo />
          <div className="flex items-center gap-2">
            <LangToggle />
            {user?.role === "admin" && (
              <Link href="/admin">
                <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-gold">
                  <Shield className="size-4" />
                  <span className="hidden sm:inline">{t("nav.admin")}</span>
                </Button>
              </Link>
            )}
            {isAuthenticated ? (
              <><Link href="/profile"><Button variant="ghost" size="sm" className="h-8 w-8 px-0 text-foreground"><User className="size-5" /></Button></Link><Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-muted-foreground" onClick={() => logout()}
              >
                <LogOut className="size-4" />
              </Button></>
            ) : (
              <a href={getLoginUrl()}>
                <Button size="sm" className="h-8 bg-gradient-to-r from-primary to-accent font-semibold">
                  {t("nav.login")}
                </Button>
              </a>
            )}
          </div>
        </div>
        {/* Category tabs */}
        <div className="border-t border-border/50 bg-background/95">
          {/* Mobile only: full-width icon+label */}
          <div className="flex h-11 items-stretch px-1 md:hidden">
            {[
              { href: "/", emoji: "🏠", label: "Home" },
              { href: "/?cat=popular", emoji: "🎮", label: "Game" },
              { href: "/rank-boost", emoji: "🏆", label: "Boost" },
              { href: "/game-accounts", emoji: "💼", label: "Acc" },
              { href: "/?cat=premium", emoji: "✨", label: "Premium" },
              { href: "/help", emoji: "🏥", label: "Help" },
            ].map(item => {
              const isActive = typeof window !== "undefined" && (window.location.pathname + window.location.search) === item.href;
              return (
                <a key={item.href} href={item.href}
                  className={["flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1 text-[9px] font-bold transition-all",
                    isActive ? "bg-gradient-to-b from-primary/20 to-primary/5 text-primary" : "text-muted-foreground hover:text-foreground",
                  ].join(" ")}>
                  <span className="text-base leading-none">{item.emoji}</span>
                  <span>{item.label}</span>
                </a>
              );
            })}
          </div>
          {/* Desktop: original style */}
          <div className="mx-auto hidden h-12 items-center gap-2 overflow-x-auto px-4 scrollbar-none md:flex md:gap-4 md:px-8">
            {[
              { href: "/", label: "🏠 Home" },
              { href: "/?cat=popular", label: "🎮 Game" },
              { href: "/rank-boost", label: "🏆 Rank Boost" },
              { href: "/game-accounts", label: "💼 Game Acc" },
              { href: "/?cat=premium", label: "✨ Premium" },
              { href: "/help", label: "🏥 Help" },
            ].map(item => (
              <a key={item.href} href={item.href}
                className={["flex shrink-0 items-center rounded-xl px-4 py-2 text-sm font-bold transition-all md:px-6 md:text-base",
                  (typeof window !== "undefined" && (window.location.pathname + window.location.search) === item.href)
                    ? "bg-gradient-to-r from-primary to-accent text-white shadow-md"
                    : "text-muted-foreground hover:bg-accent/15 hover:text-foreground",
                ].join(" ")}>{item.label}</a>
            ))}
          </div>
        </div>

      </header>
      {/* Content */}
      <main className="mx-auto w-full flex-1 px-4 pb-28 pt-5">{children}</main>

      {/* Footer */}
      <StoreFooter />

      {/* Bottom mobile nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex items-stretch justify-around px-2 py-1.5">
          {navItems.map(item => {
            const active = location === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  "press flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-semibold transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className={cn("size-5", active && "drop-shadow-[0_0_6px_oklch(0.7_0.22_350)]")} />
                {t(item.key)}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
