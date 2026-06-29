import { useAuth } from "@/_core/hooks/useAuth";
import ImageUpload from "@/components/ImageUpload";
import StatusBadge from "@/components/StatusBadge";
import StoreLayout from "@/components/StoreLayout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatKs, useLang } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import type { Order, Product } from "@shared/types";
import {
  BadgeDollarSign,
  Clock,
  ImageIcon,
  Loader2,
  Package as PackageIcon,
  Pencil,
  Plus,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/* ----------------------------- Dashboard ----------------------------- */
function Dashboard() {
  const { t } = useLang();
  const { data, isLoading } = trpc.admin.stats.useQuery();
  if (isLoading) return <Skeleton className="h-32 w-full rounded-2xl" />;
  const cards = [
    { label: t("admin.totalOrders"), value: data?.total ?? 0, icon: ShoppingBag, color: "text-primary" },
    { label: t("admin.pending"), value: data?.pending ?? 0, icon: Clock, color: "text-gold" },
    { label: t("admin.revenue"), value: formatKs(data?.revenueKs ?? 0), icon: BadgeDollarSign, color: "text-emerald-400" },
    { label: t("admin.products.count"), value: data?.productCount ?? 0, icon: PackageIcon, color: "text-accent" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map(c => (
        <div key={c.label} className="rounded-2xl border border-border bg-card p-4">
          <c.icon className={`mb-2 size-5 ${c.color}`} />
          <div className="font-display text-lg font-extrabold">{c.value}</div>
          <div className="text-xs text-muted-foreground">{c.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ----------------------------- Orders mgmt ----------------------------- */
const STATUS_OPTIONS = ["pending", "processing", "completed", "failed"] as const;

function OrdersAdmin() {
  const { t } = useLang();
  const utils = trpc.useUtils();
  const [filter, setFilter] = useState<(typeof STATUS_OPTIONS)[number] | "all">("all");
  const { data, isLoading } = trpc.admin.orders.useQuery(
    filter === "all" ? undefined : { status: filter },
  );
  const [receipt, setReceipt] = useState<string | null>(null);

  const setStatus = trpc.admin.setOrderStatus.useMutation({
    onSuccess: () => {
      toast.success("Updated");
      utils.admin.orders.invalidate();
      utils.admin.stats.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {(["all", ...STATUS_OPTIONS] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${
              filter === s ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"
            }`}
          >
            {s === "all" ? "All" : t(`status.${s}`)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : (data?.length ?? 0) === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          No orders
        </div>
      ) : (
        <div className="space-y-3">
          {data!.map((o: Order) => (
            <div key={o.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{o.productName}</div>
                  <div className="text-sm text-muted-foreground">{o.packageLabel}</div>
                </div>
                <StatusBadge status={o.status} />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <div>#{o.id} · {new Date(o.createdAt).toLocaleString()}</div>
                <div className="text-right font-bold text-primary">{formatKs(o.totalPriceKs)}</div>
                {o.gameUserId && <div>User ID: {o.gameUserId}</div>}
                {o.gameServerId && <div className="text-right">Server: {o.gameServerId}</div>}
                {o.paymentMethod && <div>Pay: {o.paymentMethod}</div>}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {o.receiptUrl ? (
                  <Button variant="secondary" size="sm" className="h-8 gap-1" onClick={() => setReceipt(o.receiptUrl!)}>
                    <ImageIcon className="size-3.5" /> {t("admin.viewReceipt")}
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">{t("admin.noReceipt")}</span>
                )}
                <div className="ml-auto flex gap-1.5">
                  {/* iStar Telegram deliver */}
                  {o.productName?.toLowerCase().includes("telegram") && o.status !== "completed" && (
                    <TelegramDeliverBtn order={o} />
                  )}
                  {o.status !== "processing" && o.status !== "completed" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 bg-accent/10 text-accent"
                      disabled={setStatus.isPending}
                      onClick={() => setStatus.mutate({ id: o.id, status: "processing" })}
                    >
                      {t("admin.markProcessing")}
                    </Button>
                  )}
                  {o.status !== "completed" && (
                    <Button
                      size="sm"
                      className="h-8 bg-emerald-600 hover:bg-emerald-700"
                      disabled={setStatus.isPending}
                      onClick={() => setStatus.mutate({ id: o.id, status: "completed" })}
                    >
                      {t("admin.approve")}
                    </Button>
                  )}
                  {o.status !== "failed" && (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-8"
                      disabled={setStatus.isPending}
                      onClick={() => setStatus.mutate({ id: o.id, status: "failed" })}
                    >
                      {t("admin.reject")}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!receipt} onOpenChange={o => !o && setReceipt(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("admin.viewReceipt")}</DialogTitle>
          </DialogHeader>
          {receipt && <img src={receipt} alt="receipt" className="max-h-[70vh] w-full rounded-lg object-contain" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ----------------------------- Products mgmt ----------------------------- */
function ProductDialog({ product, onClose }: { product?: Product; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState({
    name: product?.name ?? "",
    slug: product?.slug ?? "",
    category: (product?.category ?? "popular") as "popular" | "premium" | "other",
    description: product?.description ?? "",
    color: product?.color ?? "#FF74B8",
    imageUrl: product?.imageUrl ?? "",
    needsUserId: product?.needsUserId ?? true,
    needsServerId: product?.needsServerId ?? false,
    isActive: product?.isActive ?? true,
  });

  const create = trpc.admin.createProduct.useMutation();
  const update = trpc.admin.updateProduct.useMutation();

  async function save() {
    if (!form.name || !form.slug) {
      toast.error("Name and slug required");
      return;
    }
    try {
      const payload = {
        ...form,
        description: form.description || undefined,
        imageUrl: form.imageUrl || undefined,
      };
      if (product) {
        await update.mutateAsync({ id: product.id, data: payload });
      } else {
        await create.mutateAsync(payload);
      }
      toast.success("Saved");
      utils.admin.products.invalidate();
      utils.admin.stats.invalidate();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <DialogContent className="max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{product ? "Edit Product" : "New Product"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Name</Label>
          <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Slug</Label>
          <Input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") }))} placeholder="mobile-legends" />
        </div>
        <div className="space-y-1.5">
          <Label>Category</Label>
          <div className="flex gap-2">
            {(["popular", "premium", "other"] as const).map(c => (
              <button
                key={c}
                onClick={() => setForm(f => ({ ...f, category: c }))}
                className={`flex-1 rounded-lg border px-2 py-2 text-xs font-semibold capitalize ${
                  form.category === c ? "border-primary bg-primary/15 text-primary" : "border-border"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Description ({useLang().t("common.optional")})</Label>
          <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
        </div>
        <div className="space-y-1.5">
          <Label>Game logo / photo</Label>
          <ImageUpload
            value={form.imageUrl || null}
            onChange={url => setForm(f => ({ ...f, imageUrl: url ?? "" }))}
            folder="products"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Accent color (fallback when no photo)</Label>
          <div className="flex items-center gap-2">
            <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent" />
            <Input type="text" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} placeholder="#FF74B8" />
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
          <Label>Requires Game User ID</Label>
          <Switch checked={form.needsUserId} onCheckedChange={v => setForm(f => ({ ...f, needsUserId: v }))} />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
          <Label>Requires Server ID</Label>
          <Switch checked={form.needsServerId} onCheckedChange={v => setForm(f => ({ ...f, needsServerId: v }))} />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
          <Label>Active</Label>
          <Switch checked={form.isActive} onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))} />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={save} disabled={create.isPending || update.isPending} className="w-full">
          {create.isPending || update.isPending ? <Loader2 className="size-4 animate-spin" /> : "Save"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function PackagesManager({ productId }: { productId: number }) {
  const utils = trpc.useUtils();
  const { data } = trpc.admin.productWithPackages.useQuery({ id: productId });
  const { data: settings } = trpc.admin.getSettings.useQuery();
  const usdToKs = (settings as any)?.usdToKs ?? 4500;
  const [label, setLabel] = useState("");
  const [priceUsd, setPriceUsd] = useState("");
  const [priceKs, setPriceKs] = useState("");
  const [useUsd, setUseUsd] = useState(false);
  const [expandedPkg, setExpandedPkg] = useState<number|null>(null);
  const [editingPkg, setEditingPkg] = useState<any>(null);

  const createPkg = trpc.admin.createPackage.useMutation({
    onSuccess: () => { utils.admin.productWithPackages.invalidate({ id: productId }); setLabel(""); setPriceUsd(""); setPriceKs(""); },
    onError: e => toast.error(e.message),
  });
  const updatePkg = trpc.admin.updatePackage.useMutation({
    onSuccess: () => { utils.admin.productWithPackages.invalidate({ id: productId }); setEditingPkg(null); },
  });
  const delPkg = trpc.admin.deletePackage.useMutation({
    onSuccess: () => utils.admin.productWithPackages.invalidate({ id: productId }),
  });

  // Auto-update all package prices when rate changes
  const updateAllPrices = trpc.admin.updatePackage.useMutation({ onSuccess: () => utils.admin.productWithPackages.invalidate({ id: productId }) });
  async function recalcAllPrices() {
    const pkgs = data?.packages ?? [];
    for (const p of pkgs) {
      if ((p as any).priceUsd) {
        const newKs = Math.round((p as any).priceUsd * usdToKs);
        await updateAllPrices.mutateAsync({ id: p.id, priceKs: newKs });
      }
    }
    toast.success("All prices updated!");
  }

  const computedKs = useUsd && priceUsd ? Math.round(parseFloat(priceUsd) * usdToKs) : parseInt(priceKs) || 0;

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-amber-400/20 bg-background/40 p-3">
      {/* Rate display + recalc */}
      <div className="flex items-center justify-between rounded-lg bg-amber-400/10 px-3 py-2 text-xs">
        <span className="text-amber-400 font-bold">💱 1 USD = {usdToKs.toLocaleString()} Ks</span>
        <button onClick={recalcAllPrices} className="rounded-lg bg-amber-400/20 px-2 py-1 text-amber-400 font-semibold hover:bg-amber-400/30 transition-all">
          🔄 Recalc All Prices
        </button>
      </div>

      {/* Package list — accordion */}
      <div className="space-y-1.5">
        {(data?.packages ?? []).map(p => (
          <div key={p.id} className="rounded-lg border border-border bg-card overflow-hidden">
            <button className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent/10 transition-all"
              onClick={() => setExpandedPkg(expandedPkg === p.id ? null : p.id)}>
              <span className="font-medium">{p.label}</span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-primary text-xs">{formatKs(p.priceKs)}</span>
                {(p as any).priceUsd && <span className="text-[10px] text-muted-foreground">(${(p as any).priceUsd})</span>}
                {p.isPopular && <span className="rounded-full bg-primary/20 px-1.5 text-[9px] font-bold text-primary">HOT</span>}
                <span className="text-muted-foreground">{expandedPkg === p.id ? "▲" : "▼"}</span>
              </div>
            </button>
            {expandedPkg === p.id && (
              <div className="border-t border-border px-3 py-2 space-y-2">
                {editingPkg?.id === p.id ? (
                  <div className="space-y-2">
                    <Input className="h-7 text-xs" placeholder="Label" value={editingPkg.label} onChange={e => setEditingPkg((v:any)=>({...v,label:e.target.value}))} />
                    <div className="flex gap-2">
                      <Input className="h-7 text-xs" type="number" placeholder="USD" value={editingPkg.priceUsd??""} onChange={e => setEditingPkg((v:any)=>({...v,priceUsd:e.target.value,priceKs:Math.round(parseFloat(e.target.value||"0")*usdToKs)}))} />
                      <Input className="h-7 text-xs" type="number" placeholder="Ks" value={editingPkg.priceKs??""} onChange={e => setEditingPkg((v:any)=>({...v,priceKs:parseInt(e.target.value)||0}))} />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="h-7 flex-1 text-xs" onClick={() => updatePkg.mutate({ id: p.id, label: editingPkg.label, priceKs: editingPkg.priceKs })}>Save</Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingPkg(null)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="h-7 flex-1 text-xs" onClick={() => setEditingPkg({...p, priceUsd:(p as any).priceUsd??""})}>✏️ Edit</Button>
                    <Switch checked={p.isActive} onCheckedChange={v => updatePkg.mutate({ id: p.id, isActive: v })} />
                    <Switch checked={p.isPopular} onCheckedChange={v => updatePkg.mutate({ id: p.id, isPopular: v })} />
                    <button onClick={() => { if(confirm("Delete?")) delPkg.mutate({ id: p.id }); }} className="text-destructive"><Trash2 className="size-3.5" /></button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {(data?.packages?.length ?? 0) === 0 && <p className="text-center text-xs text-muted-foreground py-2">No packages yet</p>}
      </div>

      {/* Add new package */}
      <div className="border-t border-border pt-2 space-y-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Price in:</span>
          <button onClick={() => setUseUsd(false)} className={`px-2 py-0.5 rounded font-bold ${!useUsd?"bg-primary text-white":"bg-muted"}`}>Ks</button>
          <button onClick={() => setUseUsd(true)} className={`px-2 py-0.5 rounded font-bold ${useUsd?"bg-primary text-white":"bg-muted"}`}>USD</button>
        </div>
        <div className="flex gap-2">
          <Input className="h-8 flex-1" placeholder="86 Diamonds" value={label} onChange={e => setLabel(e.target.value)} />
          {useUsd ? (
            <Input className="h-8 w-20" placeholder="$" type="number" step="0.01" value={priceUsd} onChange={e => setPriceUsd(e.target.value)} />
          ) : (
            <Input className="h-8 w-24" placeholder="Ks" type="number" value={priceKs} onChange={e => setPriceKs(e.target.value)} />
          )}
          <Button size="sm" className="h-8 shrink-0" disabled={!label || (!priceUsd && !priceKs) || createPkg.isPending}
            onClick={() => createPkg.mutate({ productId, label, priceKs: computedKs })}>
            <Plus className="size-4" />
          </Button>
        </div>
        {useUsd && priceUsd && <p className="text-[10px] text-muted-foreground">≈ {computedKs.toLocaleString()} Ks</p>}
      </div>
    </div>
  );
}

function ProductsAdmin() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.admin.products.useQuery();
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const del = trpc.admin.deleteProduct.useMutation({
    onSuccess: () => {
      toast.success("Deleted");
      utils.admin.products.invalidate();
      utils.admin.stats.invalidate();
    },
  });

  return (
    <div>
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogTrigger asChild>
          <Button className="mb-3 w-full gap-1 bg-gradient-to-r from-primary to-accent font-semibold">
            <Plus className="size-4" /> New Product
          </Button>
        </DialogTrigger>
        {creating && <ProductDialog onClose={() => setCreating(false)} />}
      </Dialog>

      {isLoading ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : (
        <div className="space-y-3">
          {data!.map(p => (
            <div key={p.id} className="rounded-2xl border border-border bg-card p-3">
              <div className="flex items-center gap-3">
                <div
                  className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg text-[8px] font-bold text-white"
                  style={{ background: `linear-gradient(140deg, ${p.color}, oklch(0.25 0.05 295))` }}
                >
                  {p.imageUrl ? <img src={p.imageUrl} className="size-full object-cover" /> : p.name.slice(0, 6)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{p.name}</div>
                  <div className="text-xs capitalize text-muted-foreground">
                    {p.category} {!p.isActive && "· hidden"}
                  </div>
                </div>
                <button className="text-muted-foreground" onClick={() => setEditing(p)}>
                  <Pencil className="size-4" />
                </button>
                <button className="text-destructive" onClick={() => confirm("Delete product and its packages?") && del.mutate({ id: p.id })}>
                  <Trash2 className="size-4" />
                </button>
              </div>
              <button
                className="mt-2 w-full rounded-lg bg-background/40 py-1.5 text-xs font-semibold text-muted-foreground"
                onClick={() => setExpanded(expanded === p.id ? null : p.id)}
              >
                {expanded === p.id ? "Hide packages" : "Manage packages"}
              </button>
              {expanded === p.id && <PackagesManager productId={p.id} />}
              {expanded === p.id && <StockManager productId={p.id} productName={p.name} />}
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        {editing && <ProductDialog product={editing} onClose={() => setEditing(null)} />}
      </Dialog>
    </div>
  );
}

/* ----------------------------- Payments mgmt ----------------------------- */
function PaymentsAdmin() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.admin.paymentAccounts.useQuery();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ method:"", accountNumber:"", accountName:"", instructions:"", instructionsMy:"", autoFlow:false, walletAddress:"", qrImageUrl:"" });

  const create = trpc.admin.createPaymentAccount.useMutation({
    onSuccess: () => { utils.admin.paymentAccounts.invalidate(); setCreating(false); setForm({ method:"", accountNumber:"", accountName:"", instructions:"", instructionsMy:"", autoFlow:false, walletAddress:"", qrImageUrl:"" }); },
    onError: e => toast.error(e.message),
  });
  const updateMut = trpc.admin.updatePaymentAccount.useMutation({
    onSuccess: () => { utils.admin.paymentAccounts.invalidate(); setEditing(null); },
  });
  const del = trpc.admin.deletePaymentAccount.useMutation({
    onSuccess: () => utils.admin.paymentAccounts.invalidate(),
  });

  function openEdit(a: any) {
    setEditing({ ...a });
  }

  const methodIcons: Record<string,string> = { kbzpay:"💛", wavepay:"🟣", ayapay:"🔵", ton:"💎", binance:"🟡", uabpay:"🟤", balance:"💰" };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold">Payment Accounts</h2>
        <Button size="sm" onClick={() => setCreating(true)} className="bg-gradient-to-r from-primary to-accent">+ ထည့်</Button>
      </div>

      {isLoading ? <Skeleton className="h-24 w-full rounded-2xl" /> : (
        <div className="space-y-2">
          {(data ?? []).map(a => (
            <div key={a.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{methodIcons[a.method.toLowerCase()] ?? "💳"}</span>
                  <div>
                    <div className="font-semibold text-sm uppercase tracking-wide">{a.method}</div>
                    <div className="text-xs text-muted-foreground">{a.accountNumber || a.walletAddress || "—"}{a.accountName ? ` · ${a.accountName}` : ""}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {a.autoFlow && <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">AUTO</span>}
                  {!a.isActive && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">OFF</span>}
                  <Switch checked={!!a.isActive} onCheckedChange={v => updateMut.mutate({ id: a.id, data: { isActive: v } })} />
                  <Button size="sm" variant="ghost" onClick={() => openEdit(a)}>✏️</Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { if(confirm(`${a.method} ဖျက်မလား?`)) del.mutate({ id: a.id }); }}><Trash2 className="size-4" /></Button>
                </div>
              </div>
              {a.instructions && <p className="mt-2 text-xs text-muted-foreground border-t border-border pt-2">{a.instructions}</p>}
              {a.qrImageUrl && <img src={a.qrImageUrl} className="mt-2 h-20 w-20 rounded-xl object-cover border border-border" />}
            </div>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader><DialogTitle>Payment Account ထည့်</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Method</Label><Input placeholder="kbzpay / wavepay / ayapay / ton / binance" value={form.method} onChange={e => setForm(f=>({...f,method:e.target.value.toLowerCase()}))} /></div>
            <div><Label>Account Number / Wallet</Label><Input placeholder="09791890162 or wallet address" value={form.accountNumber} onChange={e => setForm(f=>({...f,accountNumber:e.target.value}))} /></div>
            <div><Label>Account Name</Label><Input placeholder="ShineAker" value={form.accountName} onChange={e => setForm(f=>({...f,accountName:e.target.value}))} /></div>
            <div><Label>Instructions (EN)</Label><Textarea placeholder="Transfer to account and upload screenshot" value={form.instructions} onChange={e => setForm(f=>({...f,instructions:e.target.value}))} rows={2} /></div>
            <div><Label>Instructions (MY)</Label><Textarea placeholder="ငွေလွှဲပြီး screenshot တင်ပါ" value={form.instructionsMy} onChange={e => setForm(f=>({...f,instructionsMy:e.target.value}))} rows={2} /></div>
            <div><Label>QR Image URL (optional)</Label><Input placeholder="https://..." value={form.qrImageUrl} onChange={e => setForm(f=>({...f,qrImageUrl:e.target.value}))} /></div>
            <div className="flex items-center gap-3"><Switch checked={form.autoFlow} onCheckedChange={v => setForm(f=>({...f,autoFlow:v}))} /><Label>Auto Flow (TON/Crypto)</Label></div>
          </div>
          <DialogFooter>
            <Button onClick={() => create.mutate({ method:form.method, accountNumber:form.accountNumber, accountName:form.accountName||undefined, instructions:form.instructions||undefined, instructionsMy:form.instructionsMy||undefined, qrImageUrl:form.qrImageUrl||undefined, autoFlow:form.autoFlow })} disabled={!form.method || create.isPending} className="w-full bg-gradient-to-r from-primary to-accent">ဆောက်မည်</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      {editing && (
        <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing.method.toUpperCase()} ပြင်မည်</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Account Number / Wallet</Label><Input value={editing.accountNumber} onChange={e => setEditing((v:any)=>({...v,accountNumber:e.target.value}))} /></div>
              <div><Label>Account Name</Label><Input value={editing.accountName??""} onChange={e => setEditing((v:any)=>({...v,accountName:e.target.value}))} /></div>
              <div><Label>Instructions (EN)</Label><Textarea value={editing.instructions??""} onChange={e => setEditing((v:any)=>({...v,instructions:e.target.value}))} rows={2} /></div>
              <div><Label>Instructions (MY)</Label><Textarea value={editing.instructionsMy??""} onChange={e => setEditing((v:any)=>({...v,instructionsMy:e.target.value}))} rows={2} /></div>
              <div><Label>QR Image URL</Label><Input value={editing.qrImageUrl??""} onChange={e => setEditing((v:any)=>({...v,qrImageUrl:e.target.value}))} placeholder="https://..." /></div>
              <div className="flex items-center gap-3"><Switch checked={!!editing.autoFlow} onCheckedChange={v => setEditing((ev:any)=>({...ev,autoFlow:v}))} /><Label>Auto Flow</Label></div>
            </div>
            <DialogFooter>
              <Button onClick={() => updateMut.mutate({ id:editing.id, data:{ accountNumber:editing.accountNumber, accountName:editing.accountName, instructions:editing.instructions, instructionsMy:editing.instructionsMy, qrImageUrl:editing.qrImageUrl||null, autoFlow:!!editing.autoFlow } })} disabled={updateMut.isPending} className="w-full bg-gradient-to-r from-primary to-accent">သိမ်းမည်</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/* ----------------------------- Promos mgmt ----------------------------- */
function PromosAdmin() {
  const { data: promos, refetch } = trpc.promo.adminList.useQuery();
  const createMut = trpc.promo.adminCreate.useMutation({ onSuccess: () => { refetch(); setOpen(false); resetForm(); } });
  const updateMut = trpc.promo.adminUpdate.useMutation({ onSuccess: () => refetch() });
  const deleteMut = trpc.promo.adminDelete.useMutation({ onSuccess: () => refetch() });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", discountType: "percent" as "percent"|"fixed", discountValue: 10, minOrderKs: "", maxUses: "", perUserLimit: 1, expiresAt: "" });
  const resetForm = () => setForm({ code: "", discountType: "percent", discountValue: 10, minOrderKs: "", maxUses: "", perUserLimit: 1, expiresAt: "" });

  function handleCreate() {
    createMut.mutate({
      code: form.code,
      discountType: form.discountType,
      discountValue: form.discountValue,
      minOrderKs: form.minOrderKs ? Number(form.minOrderKs) : null,
      maxUses: form.maxUses ? Number(form.maxUses) : null,
      perUserLimit: form.perUserLimit,
      expiresAt: form.expiresAt || null,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold">Promo Codes</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-gradient-to-r from-primary to-accent font-semibold">+ ထည့်</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Promo Code အသစ်</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Code</Label><Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="WELCOME10" /></div>
              <div><Label>Discount Type</Label>
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.discountType} onChange={e => setForm(f => ({ ...f, discountType: e.target.value as any }))}>
                  <option value="percent">Percent (%)</option>
                  <option value="fixed">Fixed (Ks)</option>
                </select>
              </div>
              <div><Label>Discount Value {form.discountType === "percent" ? "(%)" : "(Ks)"}</Label><Input type="number" value={form.discountValue} onChange={e => setForm(f => ({ ...f, discountValue: Number(e.target.value) }))} /></div>
              <div><Label>Min Order (Ks) — optional</Label><Input type="number" value={form.minOrderKs} onChange={e => setForm(f => ({ ...f, minOrderKs: e.target.value }))} placeholder="ဗလာ = မကန့်သတ်" /></div>
              <div><Label>Max Uses — optional</Label><Input type="number" value={form.maxUses} onChange={e => setForm(f => ({ ...f, maxUses: e.target.value }))} placeholder="ဗလာ = unlimited" /></div>
              <div><Label>Per-User Limit</Label><Input type="number" value={form.perUserLimit} onChange={e => setForm(f => ({ ...f, perUserLimit: Number(e.target.value) }))} /></div>
              <div><Label>Expires At — optional</Label><Input type="date" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))} /></div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={createMut.isPending || !form.code} className="w-full bg-gradient-to-r from-primary to-accent font-semibold">ဆောက်မည်</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      {!promos || promos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">Promo code မရှိသေး</div>
      ) : (
        <div className="space-y-2">
          {promos.map(p => (
            <div key={p.id} className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold tracking-wider">{p.code}</span>
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    {p.discountType === "percent" ? `${p.discountValue}%` : `${p.discountValue.toLocaleString()} Ks`}
                  </span>
                  {!p.isActive && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">off</span>}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {p.usedCount}/{p.maxUses ?? "\u221e"} used · per-user: {p.perUserLimit}
                  {p.expiresAt && ` · expires ${new Date(p.expiresAt).toLocaleDateString()}`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={!!p.isActive} onCheckedChange={v => updateMut.mutate({ id: p.id, isActive: v })} />
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { if (confirm(`${p.code} ဖျက်မလား?`)) deleteMut.mutate({ id: p.id }); }}>✕</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ----------------------------- Branding mgmt ----------------------------- */
function BrandingAdmin() {
  const { t } = useLang();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.admin.getSettings.useQuery();
  const [form, setForm] = useState<{ brandName: string; logoUrl: string | null; tagline: string; taglineMy: string; contactEmail: string; usdToKs: number } | null>(null);

  const defaultVals = { brandName: "ShineAker", logoUrl: null, tagline: "Top Up. Power Up. Win More.", taglineMy: "ဖြည့်လိုက်၊ အားဖြည့်လိုက်၊ ပိုနိုင်လိုက်။", contactEmail: "shineaker@gmail.com", usdToKs: 4500 };
  const current = form ?? (data ? {
    brandName: data.brandName,
    logoUrl: data.logoUrl ?? null,
    tagline: data.tagline,
    taglineMy: data.taglineMy,
    contactEmail: (data as any).contactEmail ?? "",
    usdToKs: (data as any).usdToKs ?? 4500,
  } : isLoading ? null : defaultVals);

  const save = trpc.admin.updateSettings.useMutation({
    onSuccess: () => {
      toast.success(t("admin.saved"));
      utils.admin.getSettings.invalidate();
      utils.site.settings.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  if (isLoading || !current) return <Skeleton className="h-64 w-full rounded-2xl" />;

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
      <ImageUpload
        label={t("admin.logo")}
        value={current.logoUrl}
        onChange={url => setForm({ ...current, logoUrl: url })}
        folder="logos"
      />
      <div className="space-y-1.5">
        <Label>{t("admin.brandName")}</Label>
        <Input value={current.brandName} onChange={e => setForm({ ...current, brandName: e.target.value })} placeholder="ShineAker" />
      </div>
      <div className="space-y-1.5">
        <Label>{t("admin.tagline")}</Label>
        <Input value={current.tagline} onChange={e => setForm({ ...current, tagline: e.target.value })} placeholder="Top Up. Power Up. Win More." />
      </div>
      <div className="space-y-1.5">
        <Label>{t("admin.taglineMy")}</Label>
        <Input value={current.taglineMy} onChange={e => setForm({ ...current, taglineMy: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>{t("admin.contactEmail")}</Label>
        <Input value={current.contactEmail} onChange={e => setForm({ ...current, contactEmail: e.target.value })} placeholder="shineaker@gmail.com" />
      </div>
      <div className="space-y-1.5">
        <Label>{t("admin.usdRate")} (1 USD = ? Ks)</Label>
        <Input type="number" value={current.usdToKs} onChange={e => setForm({ ...current, usdToKs: parseInt(e.target.value, 10) || 0 })} placeholder="4500" />
      </div>
      <Button
        className="w-full bg-gradient-to-r from-primary to-accent font-semibold"
        disabled={save.isPending}
        onClick={() => save.mutate(current)}
      >
        {save.isPending ? <Loader2 className="size-4 animate-spin" /> : t("common.save")}
      </Button>
    </div>
  );
}

/* ----------------------------- Hero Banner mgmt ----------------------------- */
type BannerForm = {
  badge: string;
  title: string;
  titleMy: string;
  subtitle: string;
  subtitleMy: string;
  imageUrl: string | null;
  colorFrom: string;
  colorTo: string;
  isActive: boolean;
  sortOrder: number;
};

function BannerDialog({ banner, onClose }: { banner?: any; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState<BannerForm>({
    badge: banner?.badge ?? "",
    title: banner?.title ?? "",
    titleMy: banner?.titleMy ?? "",
    subtitle: banner?.subtitle ?? "",
    subtitleMy: banner?.subtitleMy ?? "",
    imageUrl: banner?.imageUrl ?? null,
    colorFrom: banner?.colorFrom ?? "#7C3AED",
    colorTo: banner?.colorTo ?? "#DB2777",
    isActive: banner?.isActive ?? true,
    sortOrder: banner?.sortOrder ?? 0,
  });
  const create = trpc.admin.createBanner.useMutation();
  const update = trpc.admin.updateBanner.useMutation();

  async function save() {
    if (!form.title) {
      toast.error("Title required");
      return;
    }
    try {
      const payload = {
        badge: form.badge || undefined,
        title: form.title,
        titleMy: form.titleMy || undefined,
        subtitle: form.subtitle || undefined,
        subtitleMy: form.subtitleMy || undefined,
        imageUrl: form.imageUrl,
        colorFrom: form.colorFrom,
        colorTo: form.colorTo,
        isActive: form.isActive,
        sortOrder: form.sortOrder,
      };
      if (banner) await update.mutateAsync({ id: banner.id, data: payload });
      else await create.mutateAsync(payload);
      toast.success("Saved");
      utils.admin.banners.invalidate();
      utils.site.banners.invalidate();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <DialogContent className="max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{banner ? "Edit Banner" : "New Banner"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <ImageUpload
          label="Background image (optional)"
          value={form.imageUrl}
          onChange={url => setForm(f => ({ ...f, imageUrl: url }))}
          folder="banners"
          aspect="wide"
        />
        <div className="space-y-1.5">
          <Label>Badge (optional)</Label>
          <Input value={form.badge} onChange={e => setForm(f => ({ ...f, badge: e.target.value }))} placeholder="Double Joy +20%" />
        </div>
        <div className="space-y-1.5">
          <Label>Title (English)</Label>
          <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Title (Myanmar)</Label>
          <Input value={form.titleMy} onChange={e => setForm(f => ({ ...f, titleMy: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Subtitle (English)</Label>
          <Input value={form.subtitle} onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Subtitle (Myanmar)</Label>
          <Input value={form.subtitleMy} onChange={e => setForm(f => ({ ...f, subtitleMy: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Gradient from</Label>
            <div className="flex items-center gap-2">
              <input type="color" value={form.colorFrom} onChange={e => setForm(f => ({ ...f, colorFrom: e.target.value }))} className="h-9 w-10 cursor-pointer rounded border border-border bg-transparent" />
              <Input value={form.colorFrom} onChange={e => setForm(f => ({ ...f, colorFrom: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Gradient to</Label>
            <div className="flex items-center gap-2">
              <input type="color" value={form.colorTo} onChange={e => setForm(f => ({ ...f, colorTo: e.target.value }))} className="h-9 w-10 cursor-pointer rounded border border-border bg-transparent" />
              <Input value={form.colorTo} onChange={e => setForm(f => ({ ...f, colorTo: e.target.value }))} />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Sort order</Label>
            <Input type="number" value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: parseInt(e.target.value, 10) || 0 }))} />
          </div>
          <div className="flex items-end justify-between rounded-lg border border-border px-3 py-2">
            <Label>Active</Label>
            <Switch checked={form.isActive} onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))} />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={save} disabled={create.isPending || update.isPending} className="w-full">
          {create.isPending || update.isPending ? <Loader2 className="size-4 animate-spin" /> : "Save"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function BannersAdmin() {
  const { t } = useLang();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.admin.banners.useQuery();
  const [editing, setEditing] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const del = trpc.admin.deleteBanner.useMutation({
    onSuccess: () => {
      toast.success("Deleted");
      utils.admin.banners.invalidate();
      utils.site.banners.invalidate();
    },
  });

  return (
    <div>
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogTrigger asChild>
          <Button className="mb-3 w-full gap-1 bg-gradient-to-r from-primary to-accent font-semibold">
            <Plus className="size-4" /> {t("admin.newBanner")}
          </Button>
        </DialogTrigger>
        {creating && <BannerDialog onClose={() => setCreating(false)} />}
      </Dialog>

      {isLoading ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : (
        <div className="space-y-3">
          {data!.map(b => (
            <div key={b.id} className="overflow-hidden rounded-2xl border border-border">
              <div
                className="relative flex h-24 items-center px-4"
                style={
                  b.imageUrl
                    ? { backgroundImage: `url(${b.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
                    : { background: `linear-gradient(120deg, ${b.colorFrom}, ${b.colorTo})` }
                }
              >
                <div className="absolute inset-0 bg-black/30" />
                <div className="relative">
                  {b.badge && <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white">{b.badge}</span>}
                  <div className="mt-1 line-clamp-1 font-display text-sm font-extrabold text-white">{b.title}</div>
                </div>
              </div>
              <div className="flex items-center justify-between bg-card px-3 py-2">
                <span className="text-xs text-muted-foreground">#{b.sortOrder} {!b.isActive && "· hidden"}</span>
                <div className="flex gap-3">
                  <button className="text-muted-foreground" onClick={() => setEditing(b)}><Pencil className="size-4" /></button>
                  <button className="text-destructive" onClick={() => confirm("Delete banner?") && del.mutate({ id: b.id })}><Trash2 className="size-4" /></button>
                </div>
              </div>
            </div>
          ))}
          {(data?.length ?? 0) === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No banners yet</p>}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        {editing && <BannerDialog banner={editing} onClose={() => setEditing(null)} />}
      </Dialog>
    </div>
  );
}

/* ----------------------------- Spin Prize mgmt ----------------------------- */
function PrizeDialog({ prize, onClose }: { prize?: any; onClose: () => void }) {
  const { t } = useLang();
  const utils = trpc.useUtils();
  const [form, setForm] = useState({
    label: prize?.label ?? "",
    labelMy: prize?.labelMy ?? "",
    valueKs: prize?.valueKs ?? 0,
    color: prize?.color ?? "#7C3AED",
    weight: prize?.weight ?? 10,
    isActive: prize?.isActive ?? true,
    sortOrder: prize?.sortOrder ?? 0,
  });
  const create = trpc.admin.createSpinPrize.useMutation();
  const update = trpc.admin.updateSpinPrize.useMutation();

  async function save() {
    if (!form.label) {
      toast.error("Label required");
      return;
    }
    try {
      const payload = { ...form, labelMy: form.labelMy || undefined };
      if (prize) await update.mutateAsync({ id: prize.id, data: payload });
      else await create.mutateAsync(payload);
      toast.success("Saved");
      utils.admin.spinPrizes.invalidate();
      utils.spin.status.invalidate();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <DialogContent className="max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{prize ? "Edit Prize" : "New Prize"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Label (English)</Label>
          <Input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="500 Ks" />
        </div>
        <div className="space-y-1.5">
          <Label>Label (Myanmar)</Label>
          <Input value={form.labelMy} onChange={e => setForm(f => ({ ...f, labelMy: e.target.value }))} placeholder="ቅညቅ ကျပ်" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Reward value (Ks)</Label>
            <Input type="number" value={form.valueKs} onChange={e => setForm(f => ({ ...f, valueKs: parseInt(e.target.value, 10) || 0 }))} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("admin.weight")}</Label>
            <Input type="number" value={form.weight} onChange={e => setForm(f => ({ ...f, weight: parseInt(e.target.value, 10) || 0 }))} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Slice color</Label>
          <div className="flex items-center gap-2">
            <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent" />
            <Input value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} />
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
          <Label>Active</Label>
          <Switch checked={form.isActive} onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))} />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={save} disabled={create.isPending || update.isPending} className="w-full">
          {create.isPending || update.isPending ? <Loader2 className="size-4 animate-spin" /> : "Save"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function PrizesAdmin() {
  const { t } = useLang();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.admin.spinPrizes.useQuery();
  const [editing, setEditing] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const del = trpc.admin.deleteSpinPrize.useMutation({
    onSuccess: () => {
      toast.success("Deleted");
      utils.admin.spinPrizes.invalidate();
      utils.spin.status.invalidate();
    },
  });

  return (
    <div>
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogTrigger asChild>
          <Button className="mb-3 w-full gap-1 bg-gradient-to-r from-primary to-accent font-semibold">
            <Plus className="size-4" /> {t("admin.newPrize")}
          </Button>
        </DialogTrigger>
        {creating && <PrizeDialog onClose={() => setCreating(false)} />}
      </Dialog>

      {isLoading ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : (
        <div className="space-y-2">
          {data!.map(p => (
            <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
              <span className="size-5 shrink-0 rounded-full" style={{ background: p.color }} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{p.label}</div>
                <div className="text-xs text-muted-foreground">{p.valueKs > 0 ? formatKs(p.valueKs) : "—"} · weight {p.weight} {!p.isActive && "· hidden"}</div>
              </div>
              <button className="text-muted-foreground" onClick={() => setEditing(p)}><Pencil className="size-4" /></button>
              <button className="text-destructive" onClick={() => confirm("Delete prize?") && del.mutate({ id: p.id })}><Trash2 className="size-4" /></button>
            </div>
          ))}
          {(data?.length ?? 0) === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No prizes yet</p>}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        {editing && <PrizeDialog prize={editing} onClose={() => setEditing(null)} />}
      </Dialog>
    </div>
  );
}

/* ----------------------------- Deposits mgmt ----------------------------- */
const DEP_STATUS = ["pending", "completed", "failed"] as const;

function DepositsAdmin() {
  const { t } = useLang();
  const utils = trpc.useUtils();
  const [filter, setFilter] = useState<(typeof DEP_STATUS)[number] | "all">("pending");
  const { data, isLoading } = trpc.admin.deposits.useQuery(
    filter === "all" ? undefined : { status: filter },
  );
  const [receipt, setReceipt] = useState<string | null>(null);

  const approve = trpc.admin.approveDeposit.useMutation({
    onSuccess: () => {
      toast.success(t("admin.approve"));
      utils.admin.deposits.invalidate();
    },
    onError: e => toast.error(e.message),
  });
  const reject = trpc.admin.rejectDeposit.useMutation({
    onSuccess: () => {
      toast.success(t("admin.reject"));
      utils.admin.deposits.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {(["all", ...DEP_STATUS] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${
              filter === s ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"
            }`}
          >
            {s === "all" ? "All" : t(`status.${s}`)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : (data?.length ?? 0) === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          No deposits
        </div>
      ) : (
        <div className="space-y-3">
          {data!.map(d => (
            <div key={d.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-display text-base font-extrabold text-primary">
                    {formatKs(d.amountKs)}
                  </div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    {d.method} {d.expectedTon ? `· ${d.expectedTon} TON` : ""}
                  </div>
                </div>
                <StatusBadge status={d.status} />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <div>#{d.id} · {new Date(d.createdAt).toLocaleString()}</div>
                <div className="text-right">User #{d.userId}</div>
                <div className="col-span-2 font-mono">Memo: {d.memo}</div>
                {d.txReference && <div className="col-span-2 break-all">Tx: {d.txReference}</div>}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {d.receiptUrl ? (
                  <Button variant="secondary" size="sm" className="h-8 gap-1" onClick={() => setReceipt(d.receiptUrl!)}>
                    <ImageIcon className="size-3.5" /> {t("admin.viewReceipt")}
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {d.autoVerify ? "TON auto-verify" : t("admin.noReceipt")}
                  </span>
                )}
                {d.status === "pending" && (
                  <div className="ml-auto flex gap-1.5">
                    <Button
                      size="sm"
                      className="h-8 bg-emerald-600 hover:bg-emerald-700"
                      disabled={approve.isPending}
                      onClick={() => approve.mutate({ id: d.id })}
                    >
                      {t("admin.approve")}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-8"
                      disabled={reject.isPending}
                      onClick={() => reject.mutate({ id: d.id })}
                    >
                      {t("admin.reject")}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!receipt} onOpenChange={o => !o && setReceipt(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("admin.viewReceipt")}</DialogTitle>
          </DialogHeader>
          {receipt && <img src={receipt} alt="receipt" className="max-h-[70vh] w-full rounded-lg object-contain" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ----------------------------- Admin shell ----------------------------- */

/* ----------------------------- Rank Boost Admin ----------------------------- */
function RankBoostAdmin() {
  const { data: orders, refetch } = trpc.rankBoost.adminList.useQuery();
  const updateMut = trpc.rankBoost.adminUpdate.useMutation({ onSuccess: () => refetch() });
  const statusColors: Record<string,string> = { pending:"text-amber-400", processing:"text-blue-400", completed:"text-emerald-400", rejected:"text-destructive" };

  return (
    <div className="space-y-3">
      <h2 className="font-display text-lg font-bold">🏆 Rank Boost Orders</h2>
      {!orders || orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">Orders မရှိသေး</div>
      ) : orders.map((o: any) => (
        <div key={o.id} className="rounded-2xl border border-border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-bold">{o.gameType}</span>
              <span className="mx-2 text-muted-foreground">—</span>
              <span className="text-sm">{o.currentRank} → {o.targetRank}</span>
            </div>
            <span className={`text-xs font-bold uppercase ${statusColors[o.status]}`}>{o.status}</span>
          </div>
          <div className="text-xs text-muted-foreground space-y-0.5">
            <div>💰 {o.priceKs?.toLocaleString()} Ks · User #{o.userId}</div>
            <div className="font-semibold text-amber-400">📧 {o.accountEmail}</div>
            <div className="font-mono">🔑 {o.accountPassword}</div>
            {o.accountNote && <div>📝 {o.accountNote}</div>}
          </div>
          <div className="flex gap-2 pt-1">
            {["processing","completed","rejected"].map(st => (
              <Button key={st} size="sm" variant={o.status===st?"default":"outline"} className="text-xs h-7"
                onClick={() => updateMut.mutate({ id: o.id, status: st as any })}>
                {st==="processing"?"▶ Processing":st==="completed"?"✅ Complete":"❌ Reject"}
              </Button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ----------------------------- Game Acc Admin ----------------------------- */
function GameAccAdmin() {
  const { data: listings, refetch } = trpc.gameAcc.adminList.useQuery();
  const updateMut = trpc.gameAcc.adminUpdate.useMutation({ onSuccess: () => refetch() });
  const [editing, setEditing] = useState<any>(null);
  const statusColors: Record<string,string> = { pending:"text-amber-400", approved:"text-blue-400", listed:"text-emerald-400", sold:"text-gray-400", rejected:"text-destructive" };

  return (
    <div className="space-y-3">
      <h2 className="font-display text-lg font-bold">💼 Game Account Listings</h2>
      {!listings || listings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">Listings မရှိသေး</div>
      ) : listings.map((l: any) => (
        <div key={l.id} className="rounded-2xl border border-border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-bold">{l.gameType}</span>
              {l.rank && <span className="ml-2 rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-400">{l.rank}</span>}
            </div>
            <span className={`text-xs font-bold uppercase ${statusColors[l.status]}`}>{l.status}</span>
          </div>
          <div className="text-xs text-muted-foreground space-y-0.5">
            {l.ign && <div>IGN: {l.ign} | UID: {l.uid}</div>}
            {l.loginMethod && <div>Login: {l.loginMethod}</div>}
            <div className="flex gap-3">
              <span>Seller asks: <b>{l.sellerPriceKs?.toLocaleString()} Ks</b></span>
              <span className="text-emerald-400">Admin buys: <b>{l.adminBuyPriceKs?.toLocaleString()} Ks</b></span>
              <span className="text-primary">Lists at: <b>{l.adminSellPriceKs?.toLocaleString()} Ks</b></span>
            </div>
            {l.accountDetails && <div className="mt-1 text-muted-foreground">{l.accountDetails?.slice(0,100)}</div>}
            {l.screenshotUrl && <a href={l.screenshotUrl} target="_blank" rel="noreferrer" className="text-primary text-xs hover:underline">📷 Screenshots</a>}
          </div>
          <div className="flex gap-2 pt-1 flex-wrap">
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setEditing(l)}>✏️ Edit & Publish</Button>
            <Button size="sm" variant="outline" className="text-xs h-7 text-emerald-400" onClick={() => updateMut.mutate({ id: l.id, status: "listed" })}>✅ List</Button>
            <Button size="sm" variant="outline" className="text-xs h-7 text-blue-400" onClick={() => updateMut.mutate({ id: l.id, status: "sold" })}>💰 Sold</Button>
            <Button size="sm" variant="outline" className="text-xs h-7 text-destructive" onClick={() => updateMut.mutate({ id: l.id, status: "rejected" })}>❌ Reject</Button>
          </div>
        </div>
      ))}

      {editing && (
        <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>💼 Edit & Publish Listing</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Admin Credentials (Gmail/Password)</Label><Textarea value={editing.adminCredentials??""} onChange={e => setEditing((v:any)=>({...v,adminCredentials:e.target.value}))} placeholder="email: xxx@gmail.com | password: xxxxxxxx | recovery: xxx" rows={3} className="font-mono text-xs" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Buy Price (Ks)</Label><Input type="number" value={editing.adminBuyPriceKs} onChange={e => setEditing((v:any)=>({...v,adminBuyPriceKs:parseInt(e.target.value)||0}))} /></div>
                <div><Label className="text-xs">Sell Price (Ks)</Label><Input type="number" value={editing.adminSellPriceKs} onChange={e => setEditing((v:any)=>({...v,adminSellPriceKs:parseInt(e.target.value)||0}))} /></div>
              </div>
              <div><Label className="text-xs">Admin Note</Label><Input value={editing.adminNote??""} onChange={e => setEditing((v:any)=>({...v,adminNote:e.target.value}))} /></div>
            </div>
            <DialogFooter>
              <Button onClick={() => { updateMut.mutate({ id:editing.id, adminCredentials:editing.adminCredentials, adminBuyPriceKs:editing.adminBuyPriceKs, adminSellPriceKs:editing.adminSellPriceKs, adminNote:editing.adminNote, status:"listed" }); setEditing(null); }} className="w-full bg-gradient-to-r from-primary to-accent">🚀 Publish Listing</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}


function StockManager({ productId, productName }: { productId: number; productName: string }) {
  const { data: items, refetch } = trpc.stock.listByProduct.useQuery({ productId });
  const { data: countData } = trpc.stock.countAvailable.useQuery({ productId });
  const addMut = trpc.stock.add.useMutation({ onSuccess: () => { refetch(); setSingle(""); } });
  const bulkMut = trpc.stock.addBulk.useMutation({ onSuccess: () => { refetch(); setBulk(""); } });
  const delMut = trpc.stock.delete.useMutation({ onSuccess: () => refetch() });
  const [single, setSingle] = useState("");
  const [bulk, setBulk] = useState("");
  const [planName, setPlanName] = useState("Standard");
  const [tab, setTab] = useState<"list"|"add">("list");
  return (
    <div className="mt-3 rounded-2xl border border-amber-400/30 bg-amber-400/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">📦</span>
          <span className="font-bold text-sm">{productName} Stock</span>
          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">{countData ?? 0} available</span>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setTab("list")} className={`px-3 py-1 rounded-lg text-xs font-semibold ${tab==="list"?"bg-primary text-white":"bg-muted text-muted-foreground"}`}>List</button>
          <button onClick={() => setTab("add")} className={`px-3 py-1 rounded-lg text-xs font-semibold ${tab==="add"?"bg-primary text-white":"bg-muted text-muted-foreground"}`}>+ Add</button>
        </div>
      </div>
      {tab === "list" && (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {!items || items.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground py-4">Stock မရှိသေး</div>
          ) : items.map(item => (
            <div key={item.id} className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${item.isUsed ? "border-border bg-muted/30 opacity-50" : "border-emerald-500/30 bg-emerald-500/5"}`}>
              <div className="min-w-0 flex-1">
                <span className={`mr-2 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${item.isUsed ? "bg-muted text-muted-foreground" : "bg-emerald-500/20 text-emerald-400"}`}>{item.isUsed ? "USED" : "AVAIL"}</span>
                <span className="font-mono text-muted-foreground">{item.credentials.slice(0,40)}{item.credentials.length>40?"...":""}</span>
              </div>
              {!item.isUsed && <button onClick={() => { if(confirm("Delete?")) delMut.mutate({ id: item.id }); }} className="ml-2 text-destructive">✕</button>}
            </div>
          ))}
        </div>
      )}
      {tab === "add" && (
        <div className="space-y-2">
          <div><Label className="text-xs">Plan Name</Label><Input value={planName} onChange={e => setPlanName(e.target.value)} placeholder="Standard / 1 Month" className="h-8 text-xs" /></div>
          <div>
            <Label className="text-xs">Single credential</Label>
            <div className="flex gap-2 mt-1">
              <Input value={single} onChange={e => setSingle(e.target.value)} placeholder="username:password or code" className="h-8 text-xs font-mono" />
              <Button size="sm" onClick={() => addMut.mutate({ productId, planName, credentials: single })} disabled={!single.trim()||addMut.isPending} className="h-8 px-3 text-xs">Add</Button>
            </div>
          </div>
          <div>
            <Label className="text-xs">Bulk add (တစ်ကြောင်းတစ်ခု)</Label>
            <Textarea value={bulk} onChange={e => setBulk(e.target.value)} placeholder={"user1:pass1"} rows={4} className="text-xs font-mono mt-1" />
            <Button size="sm" onClick={() => bulkMut.mutate({ productId, planName, credentialsList: bulk.split("\n").map(l=>l.trim()).filter(Boolean) })} disabled={!bulk.trim()||bulkMut.isPending} className="mt-2 w-full text-xs bg-gradient-to-r from-primary to-accent">
              {bulkMut.isPending ? "Adding..." : `Bulk Add (${bulk.split("\n").filter(l=>l.trim()).length} items)`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function TelegramDeliverBtn({ order }: { order: any }) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState(order.gameUserId ?? "");
  const utils = trpc.useUtils();
  const l = (order.packageLabel ?? "").toLowerCase();
  const isStars = l.includes("stars");
  const getMonths = () => { if (l.includes("12")) return 12; if (l.includes("6")) return 6; return 3; };
  const getStars = () => { const m = l.match(/[0-9]+/); return m ? parseInt(m[0]) : 100; };
  const [mode, setMode] = useState<"premium"|"stars">(isStars ? "stars" : "premium");
  const [months, setMonths] = useState<3|6|12>(getMonths());
  const [stars, setStars] = useState(getStars());
  const { data: balance } = trpc.admin.istarBalance.useQuery(undefined, { enabled: open });
  const premiumMut = trpc.admin.deliverTelegramPremium.useMutation({
    onSuccess: () => { toast.success("Telegram Premium delivered!"); setOpen(false); utils.admin.orders.invalidate(); },
    onError: e => toast.error("Error: " + e.message),
  });
  const starsMut = trpc.admin.deliverTelegramStars.useMutation({
    onSuccess: () => { toast.success("Telegram Stars delivered!"); setOpen(false); utils.admin.orders.invalidate(); },
    onError: e => toast.error("Error: " + e.message),
  });
  return (
    <>
      <Button size="sm" className="h-8 gap-1 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 text-xs" onClick={() => setOpen(true)}>
        ✈️ Deliver
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>✈️ Telegram Delivery — #{order.id}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {balance && (
              <div className="rounded-xl bg-primary/5 border border-primary/20 px-3 py-2 text-xs">
                💰 iStar Balance: <span className="font-bold text-primary">{(balance as any).balance ?? "—"} {(balance as any).currency ?? "TON"}</span>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setMode("premium")} className={"flex-1 rounded-xl border py-2 text-sm font-bold " + (mode==="premium"?"border-primary bg-primary/10 text-primary":"border-border")}>💎 Premium</button>
              <button onClick={() => setMode("stars")} className={"flex-1 rounded-xl border py-2 text-sm font-bold " + (mode==="stars"?"border-amber-400 bg-amber-400/10 text-amber-400":"border-border")}>⭐ Stars</button>
            </div>
            <div>
              <Label className="text-xs">Telegram Username</Label>
              <Input className="mt-1" placeholder="@username" value={username} onChange={e => setUsername(e.target.value)} />
            </div>
            {mode === "premium" && (
              <div>
                <Label className="text-xs">Duration</Label>
                <div className="mt-1 flex gap-2">
                  {([3,6,12] as const).map(m => (
                    <button key={m} onClick={() => setMonths(m)} className={"flex-1 rounded-xl border py-2 text-sm font-bold " + (months===m?"border-primary bg-primary/10 text-primary":"border-border")}>{m} months</button>
                  ))}
                </div>
              </div>
            )}
            {mode === "stars" && (
              <div>
                <Label className="text-xs">Stars Amount</Label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {[50,100,250,500,750,1000,1500,2500,5000].map(n => (
                    <button key={n} onClick={() => setStars(n)} className={"rounded-xl border px-3 py-1.5 text-xs font-bold " + (stars===n?"border-amber-400 bg-amber-400/10 text-amber-400":"border-border")}>{n}</button>
                  ))}
                </div>
                <Input type="number" className="mt-2 h-8 text-xs" value={stars} onChange={e => setStars(parseInt(e.target.value)||50)} />
              </div>
            )}
            <Button
              onClick={() => { if (mode==="premium") premiumMut.mutate({ orderId:order.id, username, months }); else starsMut.mutate({ orderId:order.id, username, quantity:stars }); }}
              disabled={!username||premiumMut.isPending||starsMut.isPending}
              className="w-full bg-gradient-to-r from-primary to-accent font-bold"
            >
              {(premiumMut.isPending||starsMut.isPending) ? "Delivering..." : ("Deliver " + (mode==="premium" ? months+"m Premium" : stars+" Stars"))}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}


function GoogleReviewAdmin() {
  const { data: submissions, refetch } = trpc.googleReview.adminList.useQuery();
  const approveMut = trpc.googleReview.adminApprove.useMutation({ onSuccess: () => refetch() });

  return (
    <div className="space-y-3">
      <h2 className="font-display text-lg font-bold">🌟 Google Review Submissions</h2>
      {!submissions || submissions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">Submissions မရှိသေး</div>
      ) : submissions.map((sub: any) => (
        <div key={sub.id} className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-sm">{sub.userName ?? "User #"+sub.userId}</p>
              <p className="text-xs text-muted-foreground">{sub.userEmail} · {new Date(sub.createdAt).toLocaleDateString()}</p>
            </div>
            <span className={`text-xs font-bold uppercase ${sub.status==="approved"?"text-emerald-400":sub.status==="rejected"?"text-destructive":"text-amber-400"}`}>{sub.status}</span>
          </div>
          <a href={sub.screenshotUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline break-all">
            📸 {sub.screenshotUrl}
          </a>
          {sub.status === "pending" && (
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-xs h-8"
                onClick={() => approveMut.mutate({ id: sub.id, userId: sub.userId, status: "approved" })}>
                ✅ Approve (+🎟️ Ticket)
              </Button>
              <Button size="sm" variant="destructive" className="flex-1 text-xs h-8"
                onClick={() => approveMut.mutate({ id: sub.id, userId: sub.userId, status: "rejected" })}>
                ❌ Reject
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function Admin() {
  const { t } = useLang();
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <StoreLayout>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </StoreLayout>
    );
  }

  if (user?.role !== "admin") {
    return (
      <StoreLayout>
        <div className="py-24 text-center">
          <h1 className="font-display text-lg font-bold">{t("admin.adminOnly")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("admin.notAdmin")}</p>
        </div>
      </StoreLayout>
    );
  }

  return (
    <StoreLayout>
      <h1 className="mb-4 font-display text-xl font-bold">{t("admin.title")}</h1>
      <Tabs defaultValue="dashboard">
        <TabsList className="flex w-full flex-wrap gap-1 h-auto">
          <TabsTrigger value="dashboard" className="flex-1">{t("admin.dashboard")}</TabsTrigger>
          <TabsTrigger value="orders" className="flex-1">{t("admin.orders")}</TabsTrigger>
          <TabsTrigger value="deposits" className="flex-1">{t("admin.deposits")}</TabsTrigger>
          <TabsTrigger value="products" className="flex-1">{t("admin.products")}</TabsTrigger>
          <TabsTrigger value="branding" className="flex-1">{t("admin.branding")}</TabsTrigger>
          <TabsTrigger value="banners" className="flex-1">{t("admin.banners")}</TabsTrigger>
          <TabsTrigger value="prizes" className="flex-1">{t("admin.prizes")}</TabsTrigger>
          <TabsTrigger value="payments" className="flex-1">{t("admin.payments")}</TabsTrigger>
          <TabsTrigger value="promos" className="flex-1">Promos 🏷️</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard" className="mt-4">
          <Dashboard />
        </TabsContent>
        <TabsContent value="orders" className="mt-4">
          <OrdersAdmin />
        </TabsContent>
        <TabsContent value="deposits" className="mt-4">
          <DepositsAdmin />
        </TabsContent>
        <TabsContent value="products" className="mt-4">
          <ProductsAdmin />
        </TabsContent>
        <TabsContent value="branding" className="mt-4">
          <BrandingAdmin />
        </TabsContent>
        <TabsContent value="banners" className="mt-4">
          <BannersAdmin />
        </TabsContent>
        <TabsContent value="prizes" className="mt-4">
          <PrizesAdmin />
        </TabsContent>
        <TabsContent value="payments" className="mt-4">
          <PaymentsAdmin />
        </TabsContent>
        <TabsContent value="promos" className="mt-4">
          <PromosAdmin />
        </TabsContent>
      </Tabs>
    </StoreLayout>
  );
}
