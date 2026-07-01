import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { useLang } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Gamepad2, HeadphonesIcon, History, Home, LogOut, MessageCircle, Shield, Sparkles, Trophy, User, Wallet } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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


function useChatNotifications() {
  const { isAuthenticated } = useAuth();
  const { data } = trpc.support.notifications.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 8000,
  });
  const prevCount = useRef(0);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    const baseTitle = "Gamingitem-MM";
    if (data.count > 0) {
      document.title = `(${data.count}) ${baseTitle}`;
    } else {
      document.title = baseTitle;
    }
    if (data.count > prevCount.current && data.latestMessage) {
      setToast(data.latestMessage);
      const t = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(t);
    }
    prevCount.current = data.count;
  }, [data]);

  return { unreadCount: data?.count ?? 0, toast, dismissToast: () => setToast(null) };
}

function ChatToast({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  if (!message) return null;
  return (
    <div className="fixed left-1/2 top-4 z-[100] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 animate-in fade-in slide-in-from-top-4">
      <Link
        href="/help"
        onClick={onDismiss}
        className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-3 shadow-2xl shadow-primary/40"
      >
        <span className="text-xl shrink-0">💬</span>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-extrabold text-white">Admin စာပို့လိုက်ပါပြီ</div>
          <div className="truncate text-[11px] text-white/80">{message}</div>
        </div>
      </Link>
    </div>
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
  const { unreadCount, toast, dismissToast } = useChatNotifications();

  return (
    <div className="min-h-screen flex flex-col">
      <ChatToast message={toast} onDismiss={dismissToast} />
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
              { href: "/help", emoji: "💬", label: "Chat" },
            ].map(item => {
              const isActive = typeof window !== "undefined" && (window.location.pathname + window.location.search) === item.href;
              return (
                <a key={item.href} href={item.href}
                  className={["flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1 text-[9px] font-bold transition-all",
                    isActive ? "bg-gradient-to-b from-primary/20 to-primary/5 text-primary" : "text-muted-foreground hover:text-foreground",
                  ].join(" ")}>
                  <span className="relative text-base leading-none">
                    {item.emoji}
                    {item.href === "/help" && unreadCount > 0 && (
                      <span className="absolute -right-2 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-0.5 text-[8px] font-bold text-white ring-2 ring-background">
                        {unreadCount}
                      </span>
                    )}
                  </span>
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
              { href: "/help", label: "💬 Chat" },
            ].map(item => (
              <a key={item.href} href={item.href}
                className={["relative flex shrink-0 items-center rounded-xl px-4 py-2 text-sm font-bold transition-all md:px-6 md:text-base",
                  (typeof window !== "undefined" && (window.location.pathname + window.location.search) === item.href)
                    ? "bg-gradient-to-r from-primary to-accent text-white shadow-md"
                    : "text-muted-foreground hover:bg-accent/15 hover:text-foreground",
                ].join(" ")}>
                {item.label}
                {item.href === "/help" && unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-background">
                    {unreadCount}
                  </span>
                )}
              </a>
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
                <span className="relative">
                  <Icon className={cn("size-5", active && "drop-shadow-[0_0_6px_oklch(0.7_0.22_350)]")} />
                  {item.path === "/help" && unreadCount > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-0.5 text-[8px] font-bold text-white ring-2 ring-background">
                      {unreadCount}
                    </span>
                  )}
                </span>
                {t(item.key)}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
