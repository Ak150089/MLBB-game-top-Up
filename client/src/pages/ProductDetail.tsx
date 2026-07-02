import { useAuth } from "@/_core/hooks/useAuth";
import StoreLayout from "@/components/StoreLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { getLoginUrl } from "@/const";
import { formatKs, useLang } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import type { Package } from "@shared/types";
import { ArrowLeft, Check, Copy, ImageUp, Loader2, Wallet } from "lucide-react";
import PackageGrid from "@/components/PackageGrid";
import UidChecker from "@/components/UidChecker";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Link, useLocation, useRoute } from "wouter";


function ReviewsSection({ productId }: { productId: number }) {
  const { data: reviews } = trpc.review.forProduct.useQuery({ productId });
  if (!reviews || reviews.length === 0) return (
    <div className="mt-6">
      <h3 className="mb-2 font-display text-base font-bold">⭐ Reviews</h3>
      <div className="rounded-2xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">Review မရှိသေး — ဝယ်ပြီး review တင်ပါ!</div>
    </div>
  );
  const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="font-display text-base font-bold">⭐ Reviews</h3>
        <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-xs font-bold text-amber-400">{avg.toFixed(1)} / 5</span>
        <span className="text-xs text-muted-foreground">({reviews.length} reviews)</span>
      </div>
      <div className="space-y-2">
        {reviews.map(r => (
          <div key={r.id} className="rounded-2xl border border-border bg-card p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                {Array.from({length:5}).map((_,i) => (
                  <Star key={i} className={`size-3.5 ${i < r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                ))}
              </div>
              <span className="text-[10px] text-muted-foreground">{r.userName ?? "User"} · {new Date(r.createdAt).toLocaleDateString()}</span>
            </div>
            {r.comment && <p className="mt-1.5 text-sm text-muted-foreground">{r.comment}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProductDetail() {
  const { t } = useLang();
  const [, params] = useRoute("/product/:slug");
  const [, navigate] = useLocation();
  const slug = params?.slug ?? "";
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.catalog.productBySlug.useQuery({ slug }, { enabled: !!slug });
  const { data: payAccounts } = trpc.catalog.paymentAccounts.useQuery();
  const { data: balanceData } = trpc.balance.get.useQuery(undefined, { enabled: isAuthenticated });
  const balanceKs = balanceData?.balanceKs ?? 0;

  const [selected, setSelected] = useState<Package | null>(null);
  const [uid, setUid] = useState("");
  const [serverId, setServerId] = useState("");
  const [playerName, setPlayerName] = useState("");
  const orderFormRef = useRef<HTMLDivElement>(null);
  const [gameUserId, setGameUserId] = useState("");
  const [gameServerId, setGameServerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [promoInput, setPromoInput] = useState("");
  const [receiptDataUrl, setReceiptDataUrl] = useState<string | undefined>();
  const fileRef = useRef<HTMLInputElement>(null);

  const promoValidate = trpc.promo.validate.useQuery(
    { code: promoCode, packageId: selected?.id ?? 0 },
    { enabled: !!promoCode && !!selected, staleTime: 10_000 }
  );
  const discountKs = promoValidate.data?.valid ? (promoValidate.data.discountKs ?? 0) : 0;
  const finalKs = (selected?.priceKs ?? 0) - discountKs;

  const createOrder = trpc.orders.create.useMutation({
    onSuccess: () => {
      toast.success(t("product.orderPlaced"));
      utils.orders.myOrders.invalidate();
      navigate("/orders");
    },
    onError: err => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <StoreLayout>
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="mt-4 grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map(i => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </StoreLayout>
    );
  }

  if (!data) {
    return (
      <StoreLayout>
        <div className="py-20 text-center text-muted-foreground">Product not found.</div>
      </StoreLayout>
    );
  }

  const { product, packages } = data;

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image too large (max 5MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setReceiptDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  function submit() {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    if (!selected) {
      toast.error(t("product.selectFirst"));
      return;
    }
    if (product.needsUserId && !gameUserId.trim()) {
      toast.error(t("product.gameUserId"));
      return;
    }
    if (product.needsServerId && !gameServerId.trim()) {
      toast.error(t("product.serverId"));
      return;
    }
    if (paymentMethod === "balance" && balanceKs < (selected.priceKs ?? 0)) {
      toast.error(t("balance.insufficient"));
      return;
    }
    createOrder.mutate({
      packageId: selected.id,
      gameUserId: gameUserId.trim() || undefined,
      gameServerId: gameServerId.trim() || undefined,
      paymentMethod: paymentMethod || undefined,
      receiptDataUrl,
      promoCode: promoCode || undefined,
    });
  }

  return (
    <StoreLayout>
      <Link href="/" className="press mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="size-4" /> {t("common.back")}
      </Link>

      {/* Product header */}
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
        <div
          className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl"
          style={{ background: `linear-gradient(140deg, ${product.color}, oklch(0.25 0.05 295))` }}
        >
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="size-full object-cover" />
          ) : (
            <span className="px-1 text-center text-xs font-bold text-white">{product.name}</span>
          )}
        </div>
        <div className="min-w-0">
          <h1 className="truncate font-display text-lg font-bold">{product.name}</h1>
          {product.description && (
            <p className="line-clamp-2 text-xs text-muted-foreground">{product.description}</p>
          )}
        </div>
      </div>

      {/* Packages — lootbar style */}
      <h2 className="mb-3 mt-5 font-display text-base font-bold">{t("product.choosePackage")}</h2>
      <PackageGrid packages={packages} selected={selected} onSelect={setSelected} />

      {/* Sticky selected package bar */}
      {selected && (
        <div className="fixed inset-x-0 bottom-16 z-30 px-3 pb-2">
          <button
            onClick={() => orderFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="mx-auto flex w-full max-w-lg items-center gap-3 rounded-2xl border border-primary/40 bg-background/95 px-4 py-3 shadow-2xl shadow-primary/20 backdrop-blur-xl"
          >
            <div className="min-w-0 flex-1 text-left">
              <div className="truncate text-[11px] font-semibold text-muted-foreground">{selected.label}</div>
              <div className="text-sm font-extrabold text-primary">{formatKs(selected.priceKs)}</div>
            </div>
            <span className="shrink-0 rounded-xl bg-gradient-to-r from-primary to-accent px-4 py-2 text-xs font-bold text-white">
              ဆက်လုပ်မည် ↓
            </span>
          </button>
        </div>
      )}

      {/* Order form */}
      <div ref={orderFormRef} className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-4">
        {product.needsUserId && (
          <div className="space-y-1.5">
            <Label>
              {product.category === "premium"
                ? "📱 Telegram Username / Phone Number"
                : product.category === "social"
                ? "📧 Email / Username"
                : t("product.gameUserId")}
            </Label>
            {product.category !== "premium" && product.category !== "social" ? (
              <UidChecker
                gameType={product.slug ?? product.name ?? "game"}
                uid={gameUserId}
                serverId={gameServerId}
                onUidChange={setGameUserId}
                onServerIdChange={setGameServerId}
                onNameFound={() => {}}
              />
            ) : (
              <Input
                value={gameUserId}
                onChange={e => setGameUserId(e.target.value)}
                placeholder={
                  product.category === "premium"
                    ? "@username သို့မဟုတ် +959xxxxxxx"
                    : "email@example.com"
                }
                className="bg-background/50"
              />
            )}
            {product.category === "premium" && (
              <p className="text-[11px] text-muted-foreground">
                ⚠️ Telegram username သို့မဟုတ် phone number ထည့်ပါ (account login မလို)
              </p>
            )}
          </div>
        )}
        {product.needsServerId && (
          <div className="space-y-1.5">
            <Label>{t("product.serverId")}</Label>
            <Input
              value={gameServerId}
              onChange={e => setGameServerId(e.target.value)}
              placeholder="1234"
              className="bg-background/50"
            />
          </div>
        )}

        {/* Payment methods */}
        <div className="space-y-2">
          <Label>{t("product.paymentMethod")}</Label>

          {/* Pay with prepaid balance */}
          {isAuthenticated && (
            <button
              onClick={() => setPaymentMethod("balance")}
              className={cn(
                "press flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-colors",
                paymentMethod === "balance"
                  ? "border-primary bg-primary/10 ring-1 ring-primary"
                  : "border-border bg-background/40",
              )}
            >
              <span className="flex items-center gap-2">
                <Wallet className="size-4 text-primary" />
                <span className="text-sm font-semibold">{t("balance.payWith")}</span>
              </span>
              <span
                className={cn(
                  "text-xs font-bold",
                  balanceKs >= (selected?.priceKs ?? 0) ? "text-emerald-400" : "text-destructive",
                )}
              >
                {formatKs(balanceKs)}
              </span>
            </button>
          )}
          {paymentMethod === "balance" && balanceKs < (selected?.priceKs ?? 0) && (
            <div className="flex items-center justify-between rounded-lg border border-dashed border-destructive/50 bg-destructive/5 px-3 py-2 text-xs">
              <span className="text-destructive">{t("balance.insufficient")}</span>
              <Link href="/balance" className="font-semibold text-primary">
                {t("balance.add")}
              </Link>
            </div>
          )}
        </div>

        {/* Manual payment accounts */}
        {(payAccounts?.length ?? 0) > 0 && (
          <div className="space-y-2">
            <Label className="text-muted-foreground">{t("deposit.chooseMethod")}</Label>
            <div className="flex flex-wrap gap-2">
              {payAccounts!.map(acc => (
                <button
                  key={acc.id}
                  onClick={() => setPaymentMethod(acc.method)}
                  className={cn(
                    "press rounded-lg border px-3 py-1.5 text-xs font-semibold",
                    paymentMethod === acc.method
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background/40",
                  )}
                >
                  {acc.method}
                </button>
              ))}
            </div>
            {paymentMethod &&
              payAccounts!
                .filter(a => a.method === paymentMethod)
                .map(acc => (
                  <div
                    key={acc.id}
                    className="flex items-center justify-between rounded-lg border border-dashed border-border bg-background/40 px-3 py-2 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{acc.accountNumber}</span>
                        <button onClick={() => { navigator.clipboard.writeText(acc.accountNumber); toast.success("Copied!"); }} className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary hover:bg-primary/20">Copy</button>
                      </div>
                      {acc.accountName && <div className="text-muted-foreground">{acc.accountName}</div>}
                      {(acc as any).instructions && <div className="mt-1 text-muted-foreground">{(acc as any).instructions}</div>}
                      {(acc as any).qrImageUrl && <img src={(acc as any).qrImageUrl} className="mt-2 h-28 w-28 rounded-xl border border-border object-cover" />}
                    </div>
                    <button
                      className="press text-muted-foreground"
                      onClick={() => {
                        navigator.clipboard.writeText(acc.accountNumber);
                        toast.success("Copied");
                      }}
                    >
                      <Copy className="size-4" />
                    </button>
                  </div>
                ))}
          </div>
        )}

        {/* Receipt upload (only for manual payment, not balance) */}
        {paymentMethod !== "balance" && (
        <div className="space-y-1.5">
          <Label>{t("product.uploadReceipt")}</Label>
          <p className="text-[11px] text-muted-foreground">{t("product.receiptHint")}</p>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
          {receiptDataUrl ? (
            <div className="relative">
              <img
                src={receiptDataUrl}
                alt="receipt"
                className="max-h-48 w-full rounded-lg border border-border object-contain"
              />
              <Button
                variant="secondary"
                size="sm"
                className="mt-2 w-full"
                onClick={() => fileRef.current?.click()}
              >
                Change image
              </Button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="press grid w-full place-items-center gap-1 rounded-xl border border-dashed border-border bg-background/40 py-7 text-muted-foreground"
            >
              <ImageUp className="size-6" />
              <span className="text-xs">Tap to upload</span>
            </button>
          )}
        </div>
        )}
      </div>

      {/* Promo code */}
      {selected && (
        <div className="mt-4">
          <label className="text-sm font-medium">Promo Code</label>
          <div className="mt-1 flex gap-2">
            <input
              value={promoInput}
              onChange={e => setPromoInput(e.target.value.toUpperCase())}
              placeholder="WELCOME10"
              className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm uppercase outline-none"
            />
            <button
              onClick={() => setPromoCode(promoInput.trim())}
              disabled={!promoInput.trim()}
              className="h-9 rounded-md bg-primary px-3 text-sm font-semibold text-white disabled:opacity-40"
            >သုံး</button>
            {promoCode && (
              <button onClick={() => { setPromoCode(""); setPromoInput(""); }} className="h-9 rounded-md border border-border px-3 text-sm">✕</button>
            )}
          </div>
          {promoCode && promoValidate.data && (
            <p className={"mt-1.5 text-xs font-semibold " + (promoValidate.data.valid ? "text-emerald-400" : "text-destructive")}>
              {promoValidate.data.valid ? "✅ " + promoCode + " — " + discountKs.toLocaleString() + " Ks လျှော့!" : "❌ " + promoValidate.data.message}
            </p>
          )}
        </div>
      )}

      {/* Sticky submit */}
      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-sm text-muted-foreground">{t("product.total")}</span>
          {discountKs > 0 ? (
            <div className="text-right">
              <div className="text-xs line-through text-muted-foreground">{formatKs(selected?.priceKs ?? 0)}</div>
              <div className="font-display text-xl font-extrabold text-primary">{formatKs(finalKs)}</div>
            </div>
          ) : (
            <span className="font-display text-xl font-extrabold text-primary">
              {formatKs(selected?.priceKs ?? 0)}
            </span>
          )}
        </div>
        <Button
          onClick={submit}
          disabled={createOrder.isPending}
          className="press h-12 w-full bg-gradient-to-r from-primary to-accent text-base font-bold glow-primary"
        >
          {createOrder.isPending ? (
            <Loader2 className="size-5 animate-spin" />
          ) : isAuthenticated ? (
            t("product.submit")
          ) : (
            t("product.loginToOrder")
          )}
        </Button>
      </div>
      {/* Reviews section */}
      <ReviewsSection productId={product.id} />
    </StoreLayout>
  );
}
