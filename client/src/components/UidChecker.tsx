import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  gameType: string;
  uid: string;
  serverId?: string;
  onUidChange: (uid: string) => void;
  onServerIdChange?: (serverId: string) => void;
  onNameFound?: (name: string) => void;
}

const NEEDS_SERVER = ["mobile legends", "mlbb", "magic chess", "legend"];

export default function UidChecker({ gameType, uid, serverId, onUidChange, onServerIdChange, onNameFound }: Props) {
  const [playerName, setPlayerName] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle"|"loading"|"found"|"error">("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const needsServer = NEEDS_SERVER.some(g => gameType.toLowerCase().includes(g));

  const checkMut = trpc.uid.checkUid.useMutation({
    onSuccess: (res) => {
      if (res.success && res.name) {
        setPlayerName(res.name);
        setStatus("found");
        onNameFound?.(res.name);
      } else {
        setPlayerName(null);
        setStatus("error");
      }
    },
    onError: () => setStatus("error"),
  });

  // Auto-check when uid + serverId filled (debounced 800ms)
  useEffect(() => {
    const uidReady = uid.length >= 5;
    const serverReady = !needsServer || (serverId?.length ?? 0) >= 3;

    if (!uidReady || !serverReady) {
      setStatus("idle");
      setPlayerName(null);
      return;
    }

    setStatus("loading");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      checkMut.mutate({ gameType, uid, serverId });
    }, 800);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [uid, serverId, gameType]);

  return (
    <div className="space-y-2">
      {/* UID + Server ID inputs */}
      <div className={cn("grid gap-2", needsServer ? "grid-cols-2" : "grid-cols-1")}>
        <div>
          <Label className="text-xs text-muted-foreground">Game ID</Label>
          <div className="relative mt-1">
            <Input
              placeholder="784590580"
              value={uid}
              onChange={e => { onUidChange(e.target.value); setStatus("idle"); setPlayerName(null); }}
            />
            {status === "loading" && (
              <Loader2 className="absolute right-3 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>
        {needsServer && (
          <div>
            <Label className="text-xs text-muted-foreground">Server ID</Label>
            <Input
              className="mt-1"
              placeholder="12137"
              value={serverId ?? ""}
              onChange={e => { onServerIdChange?.(e.target.value); setStatus("idle"); setPlayerName(null); }}
            />
          </div>
        )}
      </div>

      {/* Name result — appears below like sample */}
      {status === "found" && playerName && (
        <div className="flex items-center gap-2 px-1">
          <CheckCircle2 className="size-3.5 shrink-0 text-emerald-400" />
          <span className="text-sm font-extrabold text-emerald-400">{playerName}</span>
        </div>
      )}
      {status === "error" && (
        <div className="flex items-center gap-2 px-1">
          <XCircle className="size-3.5 shrink-0 text-red-400" />
          <span className="text-xs text-red-400">{checkMut.data?.message ?? "UID မမှန်ကန်"}</span>
        </div>
      )}
    </div>
  );
}
