import { useAuth } from "@/_core/hooks/useAuth";
import StoreLayout from "@/components/StoreLayout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { getLoginUrl } from "@/const";
import { formatKs, useLang } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Copy,
  ImageUp,
  Loader2,
  Wallet,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

type DepositMethod = "ton" | "binance" | "kbzpay" | "wavepay" | "ayapay" | "uabpay";

const METHODS: { key: DepositMethod; label: string }[] = [
  { key: "ton", label: "TON" },
  { key: "binance", label: "Binance Pay" },
  { key: "kbzpay", label: "KBZ Pay" },
  { key: "uabpay", label: "UAB Pay" },
  { key: "wavepay", label: "Wave Pay" },
  { key: "ayapay", label: "AYA Pay" },
];

const PRESETS = [5000, 10000, 20000, 50000, 100000];

type CreatedDeposit = {
  id: number;
  memo: string;
  amountKs: number;
  method: string;
  destination: string;
  expectedTon: string | null;
  tonDeepLink: string | null;
  autoVerify: boolean;
};

function CopyButton({ value }: { value: string }) {
  const { t } = useLang();
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="press text-muted-foreground"
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        toast.success(t("common.copied"));
        setTimeout(() => setCopied(false), 1500);
      }}
      aria-label={t("common.copy")}
    >
      {copied ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
    </button>
  );
}

function DepositDialog({ onClose }: { onClose: () => void }) {
  const { t } = useLang();
  const utils = trpc.useUtils();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<DepositMethod>("ton");
  const [created, setCreated] = useState<CreatedDeposit | null>(null);
  const [receiptDataUrl, setReceiptDataUrl] = useState<string | undefined>();
  const fileRef = useRef<HTMLInputElement>(null);

  const createDeposit = trpc.deposit.create.useMutation({
    onSuccess: res => {
      setCreated(res as CreatedDeposit);
      utils.deposit.myDeposits.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  const verify = trpc.deposit.verify.useMutation({
    onSuccess: res => {
      if (res.verified) {
        toast.success(t("deposit.verified"));
        utils.balance.get.invalidate();
        utils.balance.history.invalidate();
        utils.deposit.myDeposits.invalidate();
        onClose();
      } else {
        toast.error(t("deposit.notFound"));
      }
    },
    onError: e => toast.error(e.message),
  });

  const submitReceipt = trpc.deposit.submitReceipt.useMutation({
    onSuccess: () => {
      toast.success(t("deposit.submitted"));
      utils.deposit.myDeposits.invalidate();
      onClose();
    },
    onError: e => toast.error(e.message),
  });

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

  const amountNum = parseInt(amount, 10) || 0;

  // Step 1: choose amount + method
  if (!created) {
    return (
      <DialogContent className="max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("deposit.title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("deposit.amount")}</Label>
            <Input
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="10000"
              className="bg-background/50"
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {PRESETS.map(p => (
                <button
                  key={p}
                  onClick={() => setAmount(String(p))}
                  className={cn(
                    "press rounded-full border px-2.5 py-1 text-xs font-semibold",
                    amountNum === p
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {formatKs(p)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("deposit.chooseMethod")}</Label>
            <div className="grid grid-cols-3 gap-2">
              {METHODS.map(m => (
                <button
                  key={m.key}
                  onClick={() => setMethod(m.key)}
                  className={cn(
                    "press rounded-xl border px-2 py-2.5 text-xs font-semibold transition-colors",
                    method === m.key
                      ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                      : "border-border bg-background/40",
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <Button
            className="press h-11 w-full bg-gradient-to-r from-primary to-accent font-bold"
            disabled={amountNum < 1000 || createDeposit.isPending}
            onClick={() => createDeposit.mutate({ amountKs: amountNum, method })}
          >
            {createDeposit.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              t("deposit.create")
            )}
          </Button>
          {amountNum > 0 && amountNum < 1000 && (
            <p className="text-center text-[11px] text-muted-foreground">Min 1,000 Ks</p>
          )}
        </div>
      </DialogContent>
    );
  }

  // Step 2: payment instructions
  const isTon = created.method === "ton";
  return (
    <DialogContent className="max-h-[88vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{t("deposit.sendTo")}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-4 text-center">
          <div className="text-xs text-muted-foreground">{t("deposit.amount")}</div>
          <div className="font-display text-2xl font-extrabold text-primary">
            {formatKs(created.amountKs)}
          </div>
          {isTon && created.expectedTon && (
            <div className="mt-1 text-sm font-semibold text-accent">
              ≈ {created.expectedTon} TON
            </div>
          )}
        </div>

        {/* Destination account */}
        <div className="space-y-1.5">
          <Label>{t("deposit.sendTo")}</Label>
          <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-border bg-background/40 px-3 py-2.5">
            <span className="min-w-0 break-all text-xs font-semibold">{created.destination}</span>
            <CopyButton value={created.destination} />
          </div>
        </div>

        {/* Memo */}
        <div className="space-y-1.5">
          <Label>{t("deposit.memo")}</Label>
          <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2.5">
            <span className="font-mono text-sm font-bold text-primary">{created.memo}</span>
            <CopyButton value={created.memo} />
          </div>
          <p className="text-[11px] text-muted-foreground">{t("deposit.memoHint")}</p>
        </div>

        {/* TON deep link + auto verify */}
        {isTon ? (
          <div className="space-y-2">
            {created.tonDeepLink && (
              <a href={created.tonDeepLink}>
                <Button className="press h-11 w-full bg-[#0098EA] font-bold text-white hover:bg-[#0088d4]">
                  {t("deposit.tonPay")}
                </Button>
              </a>
            )}
            <Button
              variant="outline"
              className="h-11 w-full bg-background/40 font-semibold"
              disabled={verify.isPending}
              onClick={() => verify.mutate({ depositId: created.id })}
            >
              {verify.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" /> {t("deposit.verifying")}
                </>
              ) : (
                t("deposit.verify")
              )}
            </Button>
          </div>
        ) : (
          /* Manual: upload receipt */
          <div className="space-y-1.5">
            <Label>{t("deposit.uploadReceipt")}</Label>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
            {receiptDataUrl ? (
              <div>
                <img
                  src={receiptDataUrl}
                  alt="receipt"
                  className="max-h-44 w-full rounded-lg border border-border object-contain"
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
            <Button
              className="press mt-1 h-11 w-full bg-gradient-to-r from-primary to-accent font-bold"
              disabled={!receiptDataUrl || submitReceipt.isPending}
              onClick={() =>
                receiptDataUrl &&
                submitReceipt.mutate({ depositId: created.id, receiptDataUrl })
              }
            >
              {submitReceipt.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                t("deposit.verify")
              )}
            </Button>
          </div>
        )}
      </div>
    </DialogContent>
  );
}

const TX_META: Record<string, { label: string; credit: boolean }> = {
  deposit: { label: "Deposit", credit: true },
  spin: { label: "Spin reward", credit: true },
  refund: { label: "Refund", credit: true },
  adjust: { label: "Adjustment", credit: true },
  topup: { label: "Top-up", credit: false },
};

export default function Balance() {
  const { t } = useLang();
  const { isAuthenticated, loading } = useAuth();
  const [depositOpen, setDepositOpen] = useState(false);

  const { data: balance, isLoading: balLoading } = trpc.balance.get.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: history, isLoading: histLoading } = trpc.balance.history.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  if (!loading && !isAuthenticated) {
    return (
      <StoreLayout>
        <div className="py-24 text-center">
          <Wallet className="mx-auto mb-3 size-10 text-muted-foreground" />
          <p className="mb-4 text-sm text-muted-foreground">{t("balance.loginPrompt")}</p>
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
      <h1 className="mb-4 font-display text-xl font-bold">{t("balance.title")}</h1>

      {/* Balance card */}
      <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/20 via-card to-accent/10 p-6">
        <div className="absolute -right-8 -top-8 size-32 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Wallet className="size-4" /> {t("balance.current")}
          </div>
          {balLoading ? (
            <Skeleton className="mt-2 h-10 w-40" />
          ) : (
            <div className="mt-1 font-display text-4xl font-extrabold tracking-tight">
              {formatKs(balance?.balanceKs ?? 0)}
            </div>
          )}
          <Button
            className="press mt-4 h-11 w-full bg-gradient-to-r from-primary to-accent font-bold glow-primary sm:w-auto sm:px-8"
            onClick={() => setDepositOpen(true)}
          >
            + {t("balance.add")}
          </Button>
        </div>
      </div>

      {/* Transaction history */}
      <h2 className="mb-3 mt-6 font-display text-base font-bold">{t("balance.history")}</h2>
      {histLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map(i => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : (history?.length ?? 0) === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          {t("balance.empty")}
        </div>
      ) : (
        <div className="space-y-2">
          {history!.map(tx => {
            const meta = TX_META[tx.type] ?? { label: tx.type, credit: tx.amountKs >= 0 };
            const credit = tx.amountKs >= 0;
            return (
              <div
                key={tx.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3"
              >
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-full",
                    credit ? "bg-emerald-500/15 text-emerald-400" : "bg-destructive/15 text-destructive",
                  )}
                >
                  {credit ? (
                    <ArrowDownLeft className="size-4" />
                  ) : (
                    <ArrowUpRight className="size-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    {tx.description || meta.label}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(tx.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={cn(
                      "text-sm font-bold",
                      credit ? "text-emerald-400" : "text-destructive",
                    )}
                  >
                    {credit ? "+" : ""}
                    {formatKs(tx.amountKs)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {formatKs(tx.balanceAfterKs)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        {depositOpen && <DepositDialog onClose={() => setDepositOpen(false)} />}
      </Dialog>
    </StoreLayout>
  );
}
