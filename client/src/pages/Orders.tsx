import { useAuth } from "@/_core/hooks/useAuth";
import StatusBadge from "@/components/StatusBadge";
import StoreLayout from "@/components/StoreLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getLoginUrl } from "@/const";
import { formatKs, useLang } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { PackageOpen, Receipt } from "lucide-react";

export default function Orders() {
  const { t } = useLang();
  const { isAuthenticated, loading } = useAuth();
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
            </div>
          ))}
        </div>
      )}
    </StoreLayout>
  );
}
