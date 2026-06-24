import { useLang } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

type Status = "pending" | "processing" | "completed" | "failed";

const styles: Record<Status, string> = {
  pending: "bg-gold/15 text-gold border-gold/30",
  processing: "bg-accent/15 text-accent border-accent/30",
  completed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  failed: "bg-destructive/15 text-destructive border-destructive/30",
};

export default function StatusBadge({ status }: { status: Status }) {
  const { t } = useLang();
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        styles[status],
      )}
    >
      {t(`status.${status}`)}
    </span>
  );
}
