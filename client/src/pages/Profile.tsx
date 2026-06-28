import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import StatusBadge from "@/components/StatusBadge";
import StoreLayout from "@/components/StoreLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getLoginUrl } from "@/const";
import { formatKs, useLang } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import {
  ArrowDownToLine,
  Check,
  Copy,
  ArrowUpRight,
  LogOut,
  PackageOpen,
  Receipt,
  ShieldCheck,
  UserRound,
  Wallet,
} from "lucide-react";


function ReferralSection() {
  const { data: stats } = trpc.referral.myStats.useQuery();
  const [refCopied, setRefCopied] = useState(false);
  const link = typeof window !== "undefined" ? `${window.location.origin}?ref=${stats?.referralCode ?? ""}` : "";
  function handleCopy() {
    navigator.clipboard.writeText(link).catch(() => {});
    setRefCopied(true);
    setTimeout(() => setRefCopied(false), 2000);
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex divide-x divide-border">
        {[{ label: "စုစုပေါင်း", value: stats?.total ?? 0 }, { label: "✅ Complete", value: stats?.completed ?? 0 }, { label: "⏳ Pending", value: stats?.pending ?? 0 }].map((item, i) => (
          <div key={i} className="flex-1 py-3 text-center">
            <div className="font-display text-xl font-extrabold text-primary">{item.value}</div>
            <div className="text-[10px] text-muted-foreground">{item.label}</div>
          </div>
        ))}
      </div>
      {(stats?.earned ?? 0) > 0 && (
        <div className="border-t border-border bg-primary/5 px-4 py-2 text-center text-sm font-semibold text-primary">
          🎉 {(stats?.earned ?? 0).toLocaleString()} Ks earned!
        </div>
      )}
      <div className="border-t border-border p-4">
        <p className="mb-2 text-xs text-muted-foreground">တစ်ယောက် ဖိတ်ပြီး ဝယ်ရင် <span className="font-bold text-primary">+500 Ks</span> ရမည် (Max 20)</p>
        <div className="flex gap-2">
          <div className="flex-1 truncate rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground">{stats ? link : "Loading..."}</div>
          <button onClick={handleCopy} disabled={!stats} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-40 active:scale-95 transition-all">
            {refCopied ? <><Check className="size-3" /> Copied!</> : <><Copy className="size-3" /> Copy</>}
          </button>
        </div>
        <p className="mt-1.5 text-[10px] text-muted-foreground">* ဝယ်မှ ရမည် · Max 20 ယောက်</p>
      </div>
    </div>
  );
}

function MyCouponsSection() {
  const { data: coupons, isLoading } = trpc.referral.myCoupons.useQuery();
  const [cpCopied, setCpCopied] = useState<string|null>(null);
  function handleCopy(code: string) {
    navigator.clipboard.writeText(code).catch(() => {});
    setCpCopied(code);
    setTimeout(() => setCpCopied(null), 2000);
  }
  if (isLoading) return <div className="space-y-2">{[0,1].map(i=><Skeleton key={i} className="h-14 rounded-2xl"/>)}</div>;
  if (!coupons || coupons.length === 0) return (
    <div className="rounded-2xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">Coupon မရှိသေး — ဖိတ်ဆောင်မှ ရမည်</div>
  );
  return (
    <div className="space-y-2">
      {coupons.map(c => (
        <div key={c.id} className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="shrink-0 rounded-lg bg-primary/10 px-2.5 py-1 text-sm font-black text-primary">
              {c.discountType === "percent" ? `${c.discountValue}%` : `${c.discountValue.toLocaleString()}Ks`}
            </div>
            <div className="min-w-0">
              <p className="font-mono text-sm font-bold truncate">{c.code}</p>
              <p className="text-[10px] text-muted-foreground">{c.source === "welcome" ? "🎁 Welcome" : c.source === "referral" ? "👥 Referral" : "✊ Collected"}{c.expiresAt ? ` · ${new Date(c.expiresAt).toLocaleDateString()} ထိ` : ""}</p>
            </div>
          </div>
          <button onClick={() => handleCopy(c.code)} className="shrink-0 flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold active:scale-95 transition-all">
            {cpCopied === c.code ? <><Check className="size-3 text-green-400"/><span className="text-green-400">Copied</span></> : <><Copy className="size-3"/>Use</>}
          </button>
        </div>
      ))}
    </div>
  );
}

export default function Profile() {
  const { t, lang, setLang } = useLang();
  const { user, isAuthenticated, loading, logout } = useAuth();

  const { data: balance } = trpc.balance.get.useQuery(undefined, { enabled: isAuthenticated });
  const { data: orders, isLoading: ordersLoading } = trpc.orders.myOrders.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: deposits, isLoading: depositsLoading } = trpc.deposit.myDeposits.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  if (!loading && !isAuthenticated) {
    return (
      <StoreLayout>
        <div className="py-24 text-center">
          <UserRound className="mx-auto mb-3 size-10 text-muted-foreground" />
          <p className="mb-4 text-sm text-muted-foreground">{t("profile.loginPrompt")}</p>
          <a href={getLoginUrl()}>
            <Button className="bg-gradient-to-r from-primary to-accent font-semibold">
              {t("nav.login")}
            </Button>
          </a>
        </div>
      </StoreLayout>
    );
  }

  const initial = (user?.name || user?.email || "U").charAt(0).toUpperCase();
  const recentOrders = (orders ?? []).slice(0, 5);
  const recentDeposits = (deposits ?? []).slice(0, 5);

  return (
    <StoreLayout>
      <h1 className="mb-4 font-display text-xl font-bold">{t("profile.title")}</h1>

      <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/15 via-card to-accent/10 p-5">
        <div className="flex items-center gap-4">
          <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent font-display text-2xl font-extrabold text-white shadow-lg">
            {initial}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-lg font-bold">{user?.name || t("profile.member")}</h2>
              {user?.role === "admin" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                  <ShieldCheck className="size-3" /> Admin
                </span>
              )}
            </div>
            {user?.email && <p className="truncate text-sm text-muted-foreground">{user.email}</p>}
            {user?.createdAt && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("profile.memberSince")} {new Date(user.createdAt).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-3xl border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Wallet className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("profile.balance")}</p>
            <p className="font-display text-2xl font-extrabold text-primary">
              {balance ? formatKs(balance.balanceKs) : "—"}
            </p>
          </div>
        </div>
        <Link href="/balance">
          <Button size="sm" className="gap-1 bg-gradient-to-r from-primary to-accent font-semibold">
            <ArrowDownToLine className="size-4" /> {t("profile.topUp")}
          </Button>
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link href="/orders">
          <div className="press flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
            <Receipt className="size-5 text-primary" />
            <div>
              <p className="text-sm font-semibold">{t("profile.allOrders")}</p>
              <p className="text-xs text-muted-foreground">{orders?.length ?? 0}</p>
            </div>
          </div>
        </Link>
        <Link href="/balance">
          <div className="press flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
            <ArrowDownToLine className="size-5 text-primary" />
            <div>
              <p className="text-sm font-semibold">{t("profile.deposits")}</p>
              <p className="text-xs text-muted-foreground">{deposits?.length ?? 0}</p>
            </div>
          </div>
        </Link>
      </div>

      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-display text-base font-bold">{t("profile.recentOrders")}</h3>
          {(orders?.length ?? 0) > 5 && (
            <Link href="/orders" className="text-xs font-semibold text-primary">{t("profile.viewAll")}</Link>
          )}
        </div>
        {ordersLoading ? (
          <div className="space-y-2">{[0, 1].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
        ) : recentOrders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-10 text-center">
            <PackageOpen className="mx-auto mb-2 size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t("history.empty")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentOrders.map(o => (
              <div key={o.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{o.productName}</div>
                    <div className="text-sm text-muted-foreground">{o.packageLabel}</div>
                  </div>
                  <StatusBadge status={o.status} />
                </div>
                <div className="mt-3 flex items-end justify-between border-t border-border pt-3">
                  <div className="text-xs text-muted-foreground">#{o.id} · {new Date(o.createdAt).toLocaleDateString()}</div>
                  <span className="font-display text-base font-extrabold text-primary">{formatKs(o.totalPriceKs)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-display text-base font-bold">{t("profile.recentDeposits")}</h3>
          {(deposits?.length ?? 0) > 5 && (
            <Link href="/balance" className="text-xs font-semibold text-primary">{t("profile.viewAll")}</Link>
          )}
        </div>
        {depositsLoading ? (
          <div className="space-y-2">{[0, 1].map(i => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
        ) : recentDeposits.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-10 text-center">
            <ArrowDownToLine className="mx-auto mb-2 size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t("profile.noDeposits")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentDeposits.map(d => (
              <div key={d.id} className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <ArrowUpRight className="size-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold uppercase">{d.method}</div>
                    <div className="text-xs text-muted-foreground">#{d.id} · {new Date(d.createdAt).toLocaleDateString()}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-sm font-bold">{formatKs(d.amountKs)}</span>
                  <StatusBadge status={d.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6">
        <h3 className="mb-2 font-display text-base font-bold">👥 Referral</h3>
        <ReferralSection />
      </section>

      <section className="mt-6">
        <h3 className="mb-2 font-display text-base font-bold">🎫 My Coupons</h3>
        <MyCouponsSection />
      </section>

      <section className="mt-6">
        <h3 className="mb-2 font-display text-base font-bold">{t("profile.settings")}</h3>
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between px-4 py-3.5">
            <span className="text-sm font-medium">{t("profile.language")}</span>
            <div className="flex gap-1 rounded-xl bg-background/60 p-1">
              <button onClick={() => setLang("my")} className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${lang === "my" ? "bg-primary text-white" : "text-muted-foreground"}`}>မြန်မာ</button>
              <button onClick={() => setLang("en")} className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${lang === "en" ? "bg-primary text-white" : "text-muted-foreground"}`}>English</button>
            </div>
          </div>
          {user?.role === "admin" && (
            <Link href="/admin">
              <div className="press flex items-center justify-between border-t border-border px-4 py-3.5">
                <span className="text-sm font-medium">{t("profile.adminPanel")}</span>
                <ShieldCheck className="size-4 text-primary" />
              </div>
            </Link>
          )}
          <button onClick={() => logout()} className="press flex w-full items-center justify-between border-t border-border px-4 py-3.5 text-left">
            <span className="text-sm font-medium text-destructive">{t("profile.logout")}</span>
            <LogOut className="size-4 text-destructive" />
          </button>
        </div>
      </section>

      <div className="h-6" />
    </StoreLayout>
  );
}
