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
  const [label, setLabel] = useState("");
  const [price, setPrice] = useState("");

  const createPkg = trpc.admin.createPackage.useMutation({
    onSuccess: () => {
      utils.admin.productWithPackages.invalidate({ id: productId });
      setLabel("");
      setPrice("");
    },
    onError: e => toast.error(e.message),
  });
  const delPkg = trpc.admin.deletePackage.useMutation({
    onSuccess: () => utils.admin.productWithPackages.invalidate({ id: productId }),
  });

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-border bg-background/40 p-3">
      <div className="space-y-2">
        {(data?.packages ?? []).map(p => (
          <div key={p.id} className="flex items-center justify-between rounded-lg bg-card px-3 py-2 text-sm">
            <span className="font-medium">{p.label}</span>
            <div className="flex items-center gap-3">
              <span className="font-bold text-primary">{formatKs(p.priceKs)}</span>
              <button className="text-destructive" onClick={() => delPkg.mutate({ id: p.id })}>
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>
        ))}
        {(data?.packages?.length ?? 0) === 0 && (
          <p className="text-center text-xs text-muted-foreground">No packages yet</p>
        )}
      </div>
      <div className="flex gap-2">
        <Input className="h-8" placeholder="86 Diamonds" value={label} onChange={e => setLabel(e.target.value)} />
        <Input className="h-8 w-24" placeholder="Ks" type="number" value={price} onChange={e => setPrice(e.target.value)} />
        <Button
          size="sm"
          className="h-8 shrink-0"
          disabled={!label || !price || createPkg.isPending}
          onClick={() => createPkg.mutate({ productId, label, priceKs: parseInt(price, 10) || 0 })}
        >
          <Plus className="size-4" />
        </Button>
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
  const [method, setMethod] = useState("");
  const [number, setNumber] = useState("");
  const [name, setName] = useState("");

  const create = trpc.admin.createPaymentAccount.useMutation({
    onSuccess: () => {
      utils.admin.paymentAccounts.invalidate();
      setMethod("");
      setNumber("");
      setName("");
    },
    onError: e => toast.error(e.message),
  });
  const del = trpc.admin.deletePaymentAccount.useMutation({
    onSuccess: () => utils.admin.paymentAccounts.invalidate(),
  });

  return (
    <div className="space-y-3">
      {isLoading ? (
        <Skeleton className="h-24 w-full rounded-2xl" />
      ) : (
        <div className="space-y-2">
          {data!.map(a => (
            <div key={a.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
              <div>
                <div className="text-sm font-semibold">{a.method}</div>
                <div className="text-xs text-muted-foreground">
                  {a.accountNumber} {a.accountName ? `· ${a.accountName}` : ""}
                </div>
              </div>
              <button className="text-destructive" onClick={() => del.mutate({ id: a.id })}>
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="space-y-2 rounded-2xl border border-dashed border-border p-3">
        <Input placeholder="Method (e.g. KBZPay)" value={method} onChange={e => setMethod(e.target.value)} />
        <Input placeholder="Account number" value={number} onChange={e => setNumber(e.target.value)} />
        <Input placeholder="Account name (optional)" value={name} onChange={e => setName(e.target.value)} />
        <Button
          className="w-full gap-1"
          disabled={!method || !number || create.isPending}
          onClick={() => create.mutate({ method, accountNumber: number, accountName: name || undefined })}
        >
          <Plus className="size-4" /> Add payment account
        </Button>
      </div>
    </div>
  );
}

/* ----------------------------- Branding mgmt ----------------------------- */
function BrandingAdmin() {
  const { t } = useLang();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.admin.getSettings.useQuery();
  const [form, setForm] = useState<{ brandName: string; logoUrl: string | null; tagline: string; taglineMy: string; contactEmail: string; usdToKs: number } | null>(null);

  const current =
    form ??
    (data
      ? {
          brandName: data.brandName,
          logoUrl: data.logoUrl ?? null,
          tagline: data.tagline,
          taglineMy: data.taglineMy,
          contactEmail: (data as any).contactEmail ?? "",
          usdToKs: (data as any).usdToKs ?? 4500,
        }
      : null);

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
      </Tabs>
    </StoreLayout>
  );
}
