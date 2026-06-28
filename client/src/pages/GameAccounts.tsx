import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import StoreLayout from "@/components/StoreLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { formatKs } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { ShoppingCart, PlusCircle } from "lucide-react";

const GAMES = ["Mobile Legends","PUBG Mobile","Free Fire","Genshin Impact","Honkai Star Rail","Valorant"];
const MLBB_RANKS = ["Warrior","Elite","Master","Grandmaster","Epic","Legend","Mythic","Mythic Honor","Mythic Glory","Mythical Immortal"];
const LOGIN_METHODS = ["Moonton Account","Facebook","Google","TikTok","Apple ID","VK","Email"];
const ACC_STATUS = ["Clean Account","First Owner","No Ban History","Email Included"];

export default function GameAccounts() {
  const { isAuthenticated } = useAuth();
  const [tab, setTab] = useState<"browse"|"sell">("browse");
  const [submitted, setSubmitted] = useState(false);
  const { data: listings } = trpc.gameAcc.listPublic.useQuery();
  const [form, setForm] = useState({ gameType:"Mobile Legends", uid:"", ign:"", rank:"", loginMethod:[] as string[], accountDetails:"", screenshotUrl:"", sellerPriceKs:0, accountStatus:[] as string[] });

  const submitMut = trpc.gameAcc.submit.useMutation({
    onSuccess: () => { setSubmitted(true); toast.success("Listing တင်ပြီ! Admin စစ်ဆေးပါမည်"); },
    onError: e => toast.error(e.message),
  });

  function toggleArr(arr: string[], val: string) {
    return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
  }

  return (
    <StoreLayout>
      <div className="mx-auto max-w-lg space-y-4">
        <div className="text-center">
          <h1 className="font-display text-2xl font-extrabold">💼 Game Account Market</h1>
          <p className="mt-1 text-sm text-muted-foreground">Buy & Sell verified game accounts</p>
        </div>

        {/* Tabs */}
        <div className="flex rounded-2xl border border-border overflow-hidden">
          <button onClick={() => setTab("browse")} className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold transition-all ${tab==="browse"?"bg-primary text-white":"bg-card text-muted-foreground"}`}>
            <ShoppingCart className="size-4" /> Browse Accounts
          </button>
          <button onClick={() => setTab("sell")} className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold transition-all ${tab==="sell"?"bg-primary text-white":"bg-card text-muted-foreground"}`}>
            <PlusCircle className="size-4" /> Sell Account
          </button>
        </div>

        {/* Browse tab */}
        {tab === "browse" && (
          <div className="space-y-3">
            {!listings || listings.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border py-16 text-center space-y-2">
                <div className="text-4xl">💼</div>
                <p className="font-bold">Listings မရှိသေး</p>
                <p className="text-sm text-muted-foreground">ရောင်းချင်ရင် "Sell Account" tab သွားပါ</p>
              </div>
            ) : listings.map(l => (
              <div key={l.id} className="rounded-2xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{l.gameType}</span>
                      {l.rank && <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-400">{l.rank}</span>}
                    </div>
                    {l.ign && <div className="text-xs text-muted-foreground">IGN: {l.ign}</div>}
                    {l.loginMethod && <div className="text-xs text-muted-foreground">Login: {l.loginMethod}</div>}
                  </div>
                  <div className="text-right">
                    <div className="font-display text-xl font-extrabold text-primary">{formatKs(l.adminSellPriceKs)}</div>
                  </div>
                </div>
                {l.accountDetails && <p className="text-xs text-muted-foreground border-t border-border pt-2">{l.accountDetails}</p>}
                {l.screenshotUrl && (
                  <a href={l.screenshotUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">📷 Screenshots ကြည့်မည်</a>
                )}
                <Button className="w-full bg-gradient-to-r from-primary to-accent font-bold">🛒 ဝယ်မည် — Telegram ဆက်သွယ်</Button>
              </div>
            ))}
          </div>
        )}

        {/* Sell tab */}
        {tab === "sell" && !submitted && (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <h3 className="font-display font-bold">📋 Account ရောင်းမည်</h3>
            <div className="rounded-xl bg-amber-400/10 border border-amber-400/30 px-4 py-2 text-xs text-amber-400">
              ⚠️ Admin မှ သင့်ထံ {`{asking price × 80%}`} ဖြင့် ဝယ်ပါမည်
            </div>

            <div>
              <Label className="text-xs">Game ရွေးပါ</Label>
              <select className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" value={form.gameType} onChange={e => setForm(f => ({ ...f, gameType: e.target.value }))}>
                {GAMES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Game UID</Label><Input className="mt-1 text-xs" placeholder="123456789" value={form.uid} onChange={e => setForm(f => ({ ...f, uid: e.target.value }))} /></div>
              <div><Label className="text-xs">In-Game Name</Label><Input className="mt-1 text-xs" placeholder="PlayerName" value={form.ign} onChange={e => setForm(f => ({ ...f, ign: e.target.value }))} /></div>
            </div>

            <div>
              <Label className="text-xs">Rank</Label>
              <select className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" value={form.rank} onChange={e => setForm(f => ({ ...f, rank: e.target.value }))}>
                <option value="">ရွေးပါ</option>
                {MLBB_RANKS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div>
              <Label className="text-xs">Login Method</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {LOGIN_METHODS.map(m => (
                  <button key={m} onClick={() => setForm(f => ({ ...f, loginMethod: toggleArr(f.loginMethod, m) }))} className={`rounded-lg border px-3 py-1 text-xs font-semibold transition-all ${form.loginMethod.includes(m) ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>{m}</button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs">Account Status</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {ACC_STATUS.map(s => (
                  <button key={s} onClick={() => setForm(f => ({ ...f, accountStatus: toggleArr(f.accountStatus, s) }))} className={`rounded-lg border px-3 py-1 text-xs font-semibold transition-all ${form.accountStatus.includes(s) ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" : "border-border"}`}>{s}</button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs">Account Details</Label>
              <Textarea className="mt-1 text-xs" placeholder={"Heroes: 80+\nSkins: 45+\nCollector: 5\nUC: 2000\n..."} rows={4} value={form.accountDetails} onChange={e => setForm(f => ({ ...f, accountDetails: e.target.value }))} />
            </div>

            <div>
              <Label className="text-xs">Screenshot / Video Link</Label>
              <Input className="mt-1 text-xs" placeholder="Google Drive / Telegram / Imgur link" value={form.screenshotUrl} onChange={e => setForm(f => ({ ...f, screenshotUrl: e.target.value }))} />
            </div>

            <div>
              <Label className="text-xs">Selling Price (Ks)</Label>
              <Input className="mt-1" type="number" placeholder="500000" value={form.sellerPriceKs || ""} onChange={e => setForm(f => ({ ...f, sellerPriceKs: parseInt(e.target.value) || 0 }))} />
              {form.sellerPriceKs > 0 && (
                <div className="mt-1.5 rounded-lg bg-muted/30 px-3 py-2 text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">သင် ရမည်:</span><span className="font-bold text-emerald-400">{Math.floor(form.sellerPriceKs * 0.8).toLocaleString()} Ks</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Marketplace price:</span><span className="font-bold text-primary">{Math.floor(form.sellerPriceKs * 0.96).toLocaleString()} Ks</span></div>
                </div>
              )}
            </div>

            {!isAuthenticated ? (
              <a href={getLoginUrl()} className="block w-full rounded-xl bg-gradient-to-r from-primary to-accent py-3 text-center font-bold text-white">Login ဝင်ပြီး Submit မည်</a>
            ) : (
              <Button onClick={() => submitMut.mutate({ gameType: form.gameType, uid: form.uid || undefined, ign: form.ign || undefined, rank: form.rank || undefined, loginMethod: form.loginMethod.join(", ") || undefined, accountDetails: [form.accountDetails, form.accountStatus.join(" • ")].filter(Boolean).join("\n") || undefined, screenshotUrl: form.screenshotUrl || undefined, sellerPriceKs: form.sellerPriceKs })} disabled={!form.sellerPriceKs || submitMut.isPending} className="w-full bg-gradient-to-r from-primary to-accent font-bold">
                {submitMut.isPending ? "တင်နေသည်..." : "📤 Submit for Review"}
              </Button>
            )}
          </div>
        )}

        {submitted && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center space-y-2">
            <div className="text-4xl">✅</div>
            <h3 className="font-bold text-emerald-400">Listing တင်ပြီးပါပြီ!</h3>
            <p className="text-sm text-muted-foreground">Admin မှ စစ်ဆေးပြီး ဆက်သွယ်ပါမည်</p>
          </div>
        )}
      </div>
    </StoreLayout>
  );
}
