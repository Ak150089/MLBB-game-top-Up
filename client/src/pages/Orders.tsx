import { useAuth } from "@/_core/hooks/useAuth";
import StatusBadge from "@/components/StatusBadge";
import StoreLayout from "@/components/StoreLayout";
import { useState } from "react";
import { Star, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getLoginUrl } from "@/const";
import { formatKs, useLang } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { PackageOpen, Receipt } from "lucide-react";


function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(i => (
        <button key={i} onClick={() => onChange(i)} className="transition-transform active:scale-90">
          <Star className={`size-8 ${i <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
        </button>
      ))}
    </div>
  );
}

function ReviewModal({ order, onClose }: { order: { id: number; productId: number; productName: string }; onClose: () => void }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const submitMut = trpc.review.submit.useMutation({
    onSuccess: () => { alert("⭐ Review တင်ပြီး! 🎟️ Spin ticket 1 ခု ရပြီ!"); onClose(); },
    onError: (e) => alert(e.message),
  });
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <h3 className="font-display text-lg font-bold">⭐ {order.productName} Review</h3>
        <div>
          <p className="text-sm text-muted-foreground mb-2">Rating ပေးပါ</p>
          <StarRating value={rating} onChange={setRating} />
        </div>
        <div>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="မှတ်ချက် (optional)..."
            rows={3}
            className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <p className="text-xs text-amber-400 font-semibold">🎟️ Review တင်ရင် Spin ticket 1 ခု ရမည်!</p>
        <Button
          onClick={() => submitMut.mutate({ orderId: order.id, productId: order.productId, rating, comment: comment || undefined })}
          disabled={submitMut.isPending}
          className="w-full bg-gradient-to-r from-primary to-accent font-bold"
        >
          {submitMut.isPending ? <Loader2 className="size-4 animate-spin" /> : "⭐ Review တင်မည်"}
        </Button>
      </div>
    </div>
  );
}

export default function Orders() {
  const { t } = useLang();
  const { isAuthenticated, loading } = useAuth();
  const [reviewOrder, setReviewOrder] = useState<{id:number;productId:number;productName:string}|null>(null);
  const { data: orders, isLoading } = trpc.orders.myOrders.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  if (!loading && !isAuthenticated) {
    return (
      <StoreLayout>
        <div className="py-24 text-center">
          <Receipt className="mx-auto mb-3 size-10 text-muted-foreground" />
          <p className="mb-4 text-sm text-muted-foreground">{t("product.loginToOrder")}</p>
          <a href={getLoginUrl()}>
            <Button className="bg-gradient-to-r from-primary to-accent font-semibold">
              {t("nav.login")}
            </Button>
          </a>
        </div>
        {reviewOrder && <ReviewModal order={reviewOrder} onClose={() => setReviewOrder(null)} />}
    </StoreLayout>
    );
  }

  return (
    <StoreLayout>
      <h1 className="mb-4 font-display text-xl font-bold">{t("history.title")}</h1>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map(i => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : (orders?.length ?? 0) === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-20 text-center">
          <PackageOpen className="mx-auto mb-3 size-10 text-muted-foreground" />
          <p className="font-semibold">{t("history.empty")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("history.emptySub")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders!.map(o => (
            <div key={o.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{o.productName}</div>
                  <div className="text-sm text-muted-foreground">{o.packageLabel}</div>
                </div>
                <StatusBadge status={o.status} />
                {o.status === "completed" && (
                  <button onClick={() => setReviewOrder({id:o.id, productId:o.productId, productName:o.productName})} className="flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[11px] font-bold text-amber-400 hover:bg-amber-400/25 transition-colors">
                    <Star className="size-3" /> Review
                  </button>
                )}
              </div>
              <div className="mt-3 flex items-end justify-between border-t border-border pt-3">
                <div className="space-y-0.5 text-xs text-muted-foreground">
                  {o.gameUserId && <div>ID: {o.gameUserId}{o.gameServerId ? ` (${o.gameServerId})` : ""}</div>}
                  <div>#{o.id} · {new Date(o.createdAt).toLocaleDateString()}</div>
                </div>
                <span className="font-display text-base font-extrabold text-primary">
                  {formatKs(o.totalPriceKs)}
                </span>
              </div>
              {o.adminNote && (
                <p className="mt-2 rounded-lg bg-background/50 px-2.5 py-1.5 text-xs text-muted-foreground">
                  {o.adminNote}
                </p>
              )}
              {/* Auto-verify receipt button for pending KBZ/Wave Telegram orders */}
              {o.status === "pending" &&
               ["kbzpay","wavepay","ayapay"].includes((o as any).paymentMethod) &&
               ((o.packageLabel ?? "").toLowerCase().includes("star") || (o.packageLabel ?? "").toLowerCase().includes("premium")) && (
                <div className="mt-3 space-y-2 border-t border-border pt-3">
                  {(o as any).receiptUrl ? (
                    <Button
                      size="sm"
                      className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 font-bold"
                      disabled={verifyMut.isPending}
                      onClick={() => verifyMut.mutate({ orderId: o.id })}
                    >
                      {verifyMut.isPending ? "စစ်နေသည်..." : "🔍 Receipt စစ်ပြီး Auto-Deliver"}
                    </Button>
                  ) : (
                    <p className="text-center text-xs text-amber-400">
                      ⚠️ Receipt မတင်ရသေး — Order form မှ တင်ပါ
                    </p>
                  )}
                </div>
              )}
              {(o as any).deliveredCredentials && (
                <div className="mt-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-sm">📦</span>
                    <span className="text-xs font-bold text-emerald-400">Your Credentials</span>
                  </div>
                  <div className="font-mono text-xs text-white bg-black/30 rounded-lg px-3 py-2 break-all select-all">
                    {(o as any).deliveredCredentials}
                  </div>
                  <button
                    onClick={() => { navigator.clipboard.writeText((o as any).deliveredCredentials); }}
                    className="mt-2 flex items-center gap-1 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-[11px] font-bold text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                  >
                    📋 Copy Credentials
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {reviewOrder && <ReviewModal order={reviewOrder} onClose={() => setReviewOrder(null)} />}
    </StoreLayout>
  );
}
