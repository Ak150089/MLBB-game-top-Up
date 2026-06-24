import StoreLayout from "@/components/StoreLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { formatKs, useLang } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { Crown, Medal, Trophy } from "lucide-react";

function maskName(name: string | null, idx: number) {
  if (!name) return `Player ${idx + 1}`;
  if (name.length <= 2) return name;
  return name.slice(0, 2) + "•••" + name.slice(-1);
}

export default function Leaderboard() {
  const { t } = useLang();
  const { data, isLoading } = trpc.leaderboard.top.useQuery({ limit: 20 });

  const top3 = (data ?? []).slice(0, 3);
  const rest = (data ?? []).slice(3);

  const podiumStyle = [
    "order-2 -mt-0 from-gold/30 border-gold/50",
    "order-1 mt-5 from-slate-300/20 border-slate-300/40",
    "order-3 mt-7 from-amber-700/20 border-amber-700/40",
  ];
  const medalColor = ["text-gold", "text-slate-300", "text-amber-600"];

  return (
    <StoreLayout>
      <div className="mb-5 text-center">
        <Trophy className="mx-auto mb-1 size-8 text-gold" />
        <h1 className="font-display text-xl font-bold">{t("lb.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("lb.sub")}</p>
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full rounded-2xl" />
      ) : (data?.length ?? 0) === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-20 text-center text-sm text-muted-foreground">
          {t("lb.empty")}
        </div>
      ) : (
        <>
          {/* Podium */}
          {top3.length > 0 && (
            <div className="mb-6 flex items-end justify-center gap-2">
              {top3.map((u, i) => (
                <div
                  key={u.id}
                  className={cn(
                    "flex flex-1 flex-col items-center rounded-2xl border bg-gradient-to-b to-card p-3 text-center",
                    podiumStyle[i],
                  )}
                >
                  {i === 0 ? (
                    <Crown className={cn("size-6", medalColor[i])} />
                  ) : (
                    <Medal className={cn("size-5", medalColor[i])} />
                  )}
                  <div className="mt-1 truncate text-xs font-semibold">{maskName(u.name, i)}</div>
                  <div className="mt-0.5 text-[11px] font-bold text-primary">
                    {formatKs(u.totalSpentKs)}
                  </div>
                  <span className={cn("mt-1 text-lg font-extrabold", medalColor[i])}>#{i + 1}</span>
                </div>
              ))}
            </div>
          )}

          {/* Rest */}
          {rest.length > 0 && (
            <div className="space-y-2">
              {rest.map((u, i) => (
                <div
                  key={u.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
                >
                  <span className="w-6 text-center font-display font-bold text-muted-foreground">
                    {i + 4}
                  </span>
                  <span className="flex-1 truncate text-sm font-semibold">{maskName(u.name, i + 3)}</span>
                  <span className="text-sm font-bold text-primary">{formatKs(u.totalSpentKs)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </StoreLayout>
  );
}
