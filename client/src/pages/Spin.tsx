import { useAuth } from "@/_core/hooks/useAuth";
import StoreLayout from "@/components/StoreLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getLoginUrl } from "@/const";
import { useLang } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { Gift, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const WHEEL_COLORS = [
  "oklch(0.7 0.22 350)",
  "oklch(0.62 0.2 300)",
  "oklch(0.82 0.16 85)",
  "oklch(0.65 0.18 250)",
  "oklch(0.7 0.15 180)",
  "oklch(0.5 0.08 295)",
];

function useCountdown(target: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (target <= Date.now()) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);
  const diff = Math.max(0, target - now);
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  return { done: diff <= 0, label: `${h}h ${m}m ${s}s` };
}

export default function Spin() {
  const { t, lang } = useLang();
  const { isAuthenticated, loading } = useAuth();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.spin.status.useQuery(undefined, { enabled: isAuthenticated });

  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const wheelRef = useRef<HTMLDivElement>(null);

  const spin = trpc.spin.spin.useMutation();

  const prizes = data?.prizes ?? [];
  const seg = prizes.length > 0 ? 360 / prizes.length : 60;
  const countdown = useCountdown(data?.nextAvailableAt ?? 0);
  const canSpin = (data?.canSpin || countdown.done) && !spinning;

  async function handleSpin() {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    if (!canSpin) return;
    setSpinning(true);
    try {
      const result = await spin.mutateAsync();
      // Rotate so the winning segment lands at the top pointer.
      const targetAngle = 360 * 5 + (360 - (result.index * seg + seg / 2));
      setRotation(prev => prev - (prev % 360) + targetAngle);
      setTimeout(() => {
        setSpinning(false);
        if (result.valueKs > 0) {
          toast.success(`${t("spin.youWon")}: ${result.label} 🎉`);
        } else {
          toast(result.label);
        }
        utils.spin.status.invalidate();
      }, 4200);
    } catch (err: any) {
      setSpinning(false);
      toast.error(err.message);
      utils.spin.status.invalidate();
    }
  }

  if (!loading && !isAuthenticated) {
    return (
      <StoreLayout>
        <div className="py-24 text-center">
          <Sparkles className="mx-auto mb-3 size-10 text-gold" />
          <p className="mb-4 text-sm text-muted-foreground">{t("spin.loginPrompt")}</p>
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
      <div className="mb-4 text-center">
        <h1 className="font-display text-xl font-bold">{t("spin.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("spin.sub")}</p>
      </div>

      {isLoading ? (
        <Skeleton className="mx-auto aspect-square w-72 rounded-full" />
      ) : (
        <>
          {/* Wheel */}
          <div className="relative mx-auto aspect-square w-[19rem] max-w-full">
            {/* pointer */}
            <div className="absolute left-1/2 top-[-6px] z-20 -translate-x-1/2">
              <div className="size-0 border-x-[10px] border-t-[18px] border-x-transparent border-t-gold drop-shadow" />
            </div>
            <div
              ref={wheelRef}
              className="size-full rounded-full border-4 border-gold/60 shadow-[0_0_40px_-8px_oklch(0.7_0.22_350_/_60%)]"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: spinning ? "transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : "none",
                background: `conic-gradient(${prizes
                  .map((_, i) => `${WHEEL_COLORS[i % WHEEL_COLORS.length]} ${i * seg}deg ${(i + 1) * seg}deg`)
                  .join(", ")})`,
              }}
            >
              {prizes.map((p, i) => {
                const angle = i * seg + seg / 2;
                return (
                  <div
                    key={i}
                    className="absolute left-1/2 top-1/2 origin-left"
                    style={{ transform: `rotate(${angle}deg) translateX(8px)` }}
                  >
                    <span className="inline-block whitespace-nowrap text-[10px] font-bold text-white drop-shadow">
                      {lang === "my" && (p as any).labelMy ? (p as any).labelMy : p.label}
                    </span>
                  </div>
                );
              })}
            </div>
            {/* center hub */}
            <div className="absolute left-1/2 top-1/2 z-10 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-gold bg-card">
              <Gift className="size-6 text-gold" />
            </div>
          </div>

          {/* Spin button / cooldown */}
          <div className="mx-auto mt-6 max-w-xs">
            {canSpin ? (
              <Button
                onClick={handleSpin}
                disabled={spinning}
                className="press h-12 w-full bg-gradient-to-r from-gold to-primary text-base font-extrabold text-black glow-primary"
              >
                {spinning ? t("spin.spinning") : t("spin.spinNow")}
              </Button>
            ) : (
              <div className="rounded-xl border border-border bg-card py-3 text-center">
                <div className="text-xs text-muted-foreground">{t("spin.comeBack")}</div>
                <div className="font-display text-lg font-bold text-gold">{countdown.label}</div>
              </div>
            )}
          </div>

          {/* History */}
          {(data?.history?.length ?? 0) > 0 && (
            <div className="mt-8">
              <h2 className="mb-2 font-display text-sm font-bold text-muted-foreground">
                {t("spin.history")}
              </h2>
              <div className="space-y-2">
                {data!.history.map(h => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-2.5 text-sm"
                  >
                    <span className="font-medium">{h.prizeLabel}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(h.spunAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </StoreLayout>
  );
}
