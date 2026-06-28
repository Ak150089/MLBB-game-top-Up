import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import StoreLayout from "@/components/StoreLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import { Shield, Zap, Star, Trophy } from "lucide-react";


// MLBB tier prices (+2000 applied)
const MLBB_TIER: Record<string,number> = {
  "Warrior_Elite": 7000, "Elite_Master": 10000, "Master_Grandmaster": 12000,
  "Grandmaster_Epic": 14000, "Epic_Legend": 22000, "Legend_Mythic": 17000,
  "Mythic_Mythic Honor": 37000, "Mythic Honor_Mythic Glory": 52000,
  "Mythic Glory_Mythical Immortal": 82000,
};
const MLBB_ORDER = ["Warrior","Elite","Master","Grandmaster","Epic","Legend","Mythic","Mythic Honor","Mythic Glory","Mythical Immortal"];

// HOK tier prices (+2000 applied)
const HOK_TIER: Record<string,number> = {
  "Bronze_Silver": 7000, "Silver_Gold": 7000, "Gold_Platinum": 10000,
  "Platinum_Diamond": 17000, "Diamond_Master": 27000, "Master_Grandmaster": 37000,
};
const HOK_ORDER = ["Bronze","Silver","Gold","Platinum","Diamond","Master","Grandmaster","King"];

function buildPrices(tiers: Record<string,number>, order: string[]): Record<string,number> {
  const p: Record<string,number> = {};
  for (let i = 0; i < order.length; i++) {
    let cum = 0;
    for (let j = i+1; j < order.length; j++) {
      cum += tiers[`${order[j-1]}_${order[j]}`] ?? 0;
      if (cum > 0) p[`${order[i]}_${order[j]}`] = cum;
    }
  }
  return p;
}
const MLBB_PRICES = buildPrices(MLBB_TIER, MLBB_ORDER);
const HOK_PRICES = buildPrices(HOK_TIER, HOK_ORDER);

// Genshin Impact services (+2000)
const GENSHIN_SERVICES = [
  { cat: "📅 Daily", name: "Daily Package (၁ လ)", price: 22000, note: "Commission+Resin+Events" },
  { cat: "📅 Daily", name: "Premium Daily Package (၂ လ)", price: 52000, note: "Daily+SpiralAbyss+BP" },
  { cat: "⭐ Fate Farming", name: "Primogems 1,600 (≈10 pulls)", price: 9000, note: "" },
  { cat: "⭐ Fate Farming", name: "Primogems 3,200 (≈20 pulls)", price: 16000, note: "" },
  { cat: "⭐ Fate Farming", name: "Primogems 4,800 (≈30 pulls)", price: 23000, note: "" },
  { cat: "⭐ Fate Farming", name: "Primogems 6,400 (≈40 pulls)", price: 30000, note: "" },
  { cat: "🎣 Fishing", name: "The Catch R5", price: 10000, note: "" },
  { cat: "🎣 Fishing", name: "Fleuve Cendre R5", price: 10000, note: "" },
  { cat: "🗺️ Exploration", name: "Mondstadt (100%)", price: 8500, note: "" },
  { cat: "🗺️ Exploration", name: "Liyue (100%)", price: 9000, note: "" },
  { cat: "🗺️ Exploration", name: "Inazuma (100%)", price: 9500, note: "" },
  { cat: "🗺️ Exploration", name: "Dragonspine (100%)", price: 10000, note: "" },
  { cat: "🗺️ Exploration", name: "The Chasm (100%)", price: 17000, note: "Upper+Underground" },
  { cat: "🗺️ Exploration", name: "Enkanomiya (100%)", price: 12000, note: "" },
  { cat: "🗺️ Exploration", name: "Sumeru (100%)", price: 9000, note: "" },
  { cat: "🗺️ Exploration", name: "Fontaine (100%)", price: 9500, note: "" },
  { cat: "🗺️ Exploration", name: "Natlan (100%)", price: 9500, note: "" },
  { cat: "🗺️ Exploration", name: "Nod-Krai (100%)", price: 10000, note: "" },
  { cat: "⚔️ Character Build", name: "Character Lv 1→90", price: 8500, note: "" },
  { cat: "⚔️ Character Build", name: "Weapon Lv 1→90", price: 6000, note: "" },
  { cat: "⚔️ Character Build", name: "Triple Crown Talents", price: 8000, note: "" },
  { cat: "⚔️ Character Build", name: "Full Character Build", price: 17000, note: "Level+Talent+Weapon" },
  { cat: "📖 Quest", name: "Mini Quest", price: 3000, note: "" },
  { cat: "📖 Quest", name: "Main Quest", price: 5000, note: "" },
  { cat: "📖 Quest", name: "Archon Quest (1 Act)", price: 7000, note: "" },
  { cat: "📖 Quest", name: "Story Quest", price: 5500, note: "" },
  { cat: "📖 Quest", name: "Weekly Reputation", price: 6000, note: "" },
  { cat: "🎉 Events", name: "Small Event", price: 5000, note: "" },
  { cat: "🎉 Events", name: "Main Event", price: 7000, note: "" },
  { cat: "🏆 Endgame", name: "Spiral Abyss Full Clear", price: 17000, note: "" },
  { cat: "🏆 Endgame", name: "Spiral Abyss 36★", price: 22000, note: "" },
];

// WW services (+2000)
const WW_SERVICES = [
  { cat: "🗺️ Exploration", name: "Region Exploration (100%)", price: 7000, note: "Chest+Puzzle+Sonance" },
  { cat: "🎉 Events", name: "Small Event", price: 4000, note: "" },
  { cat: "🎉 Events", name: "Major Event", price: 8000, note: "" },
  { cat: "⭐ Astrite Farming", name: "10 Pulls (≈1,600 Astrites)", price: 8000, note: "" },
  { cat: "🏆 Endgame", name: "White Tower (per tower)", price: 3500, note: "" },
  { cat: "🏆 Endgame", name: "Red Tower (per tower)", price: 5000, note: "" },
  { cat: "🏆 Endgame", name: "Whimpering Wastes (per stage)", price: 4000, note: "" },
];

const ADDONS = [
  { key: "express", label: "⚡ Express (24h)", pct: 20 },
  { key: "preferred", label: "🦸 Preferred Hero", pct: 10 },
  { key: "livestream", label: "📹 Live Stream", pct: 10 },
];

function calcPrice(gameId: string, from: string, to: string, addons: string[]): number {
  const prices = gameId === "hok" ? HOK_PRICES : MLBB_PRICES;
  const base = prices[`${from}_${to}`] ?? 0;
  if (!base) return 0;
  const extra = addons.reduce((sum, k) => {
    const a = ADDONS.find(x => x.key === k);
    return sum + (a ? base * a.pct / 100 : 0);
  }, 0);
  return Math.round(base + extra);
}

function calcProgressionPrice(services: string[], svcs: typeof GENSHIN_SERVICES, addons: string[]) {
  const items = services.map(n => svcs.find(s => s.name === n)).filter(Boolean) as typeof GENSHIN_SERVICES;
  const base = items.reduce((s, i) => s + i.price, 0);
  const extra = addons.reduce((s, k) => {
    const a = ADDONS.find(x => x.key === k);
    return s + (a ? base * a.pct / 100 : 0);
  }, 0);
  return { total: Math.round(base + extra), items };
}

const GAMES = [
  { id: "mlbb", name: "Mobile Legends", emoji: "⚔️", type: "rank_boost" },
  { id: "hok", name: "Honor of Kings", emoji: "👑", type: "rank_boost" },
  { id: "genshin", name: "Genshin Impact", emoji: "🌟", type: "progression" },
  { id: "wuwa", name: "Wuthering Waves", emoji: "🌊", type: "progression" },
];

const MLBB_RANKS = ["Warrior","Elite","Master","Grandmaster","Epic","Legend","Mythic","Mythic Honor","Mythic Glory","Mythical Immortal"];
const HOK_RANKS = ["Bronze","Silver","Gold","Platinum","Diamond","Master","Grandmaster","King"];
const SERVERS_GENSHIN = ["Asia","America","Europe","TW/HK/MO"];
const SERVERS_WUWA = ["Asia","America","Europe","SEA"];

const PROGRESSION_SERVICES = [
  "Daily Commission / Daily Activity",
  "Story / Main Quest",
  "Archon / Main Story",
  "World Quest / Side Quest",
  "Exploration (100%)",
  "Treasure Chest Farming",
  "Oculus / Collectibles",
  "Boss Farming",
  "Domain Farming",
  "Material Farming",
  "Artifact / Echo Farming",
  "Character Ascension",
  "Weapon Ascension",
  "Talent / Skill Upgrade",
  "Battle Pass Missions",
  "Event Completion",
  "Spiral Abyss / Tower Challenge",
  "Custom Request",
];

const STATUS_FLOW = [
  { key: "new", label: "New Order", color: "text-blue-400" },
  { key: "review", label: "Review", color: "text-amber-400" },
  { key: "quotation", label: "Quotation", color: "text-purple-400" },
  { key: "payment_received", label: "Payment Received", color: "text-emerald-400" },
  { key: "booster_assigned", label: "Booster Assigned", color: "text-cyan-400" },
  { key: "in_progress", label: "In Progress", color: "text-orange-400" },
  { key: "completed", label: "Completed", color: "text-green-400" },
  { key: "delivered", label: "Delivered", color: "text-green-500" },
  { key: "closed", label: "Closed", color: "text-muted-foreground" },
];

export default function RankBoost() {
  const { isAuthenticated } = useAuth();
  const [selectedGame, setSelectedGame] = useState(GAMES[0]);
  const [boostType, setBoostType] = useState<"pilot"|"duo">("pilot");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [showMyOrders, setShowMyOrders] = useState(false);
  const [form, setForm] = useState({ uid:"", serverId:"", currentRank:"", targetRank:"", currentStars:"", adventureRank:"", contact:"", accountNote:"", screenshotUrl:"" });

  const { data: myOrders } = trpc.rankBoost.myOrders.useQuery(undefined, { enabled: isAuthenticated && showMyOrders });
  const createMut = trpc.rankBoost.create.useMutation({
    onSuccess: () => { setSubmitted(true); toast.success("Order တင်ပြီ! Admin မှ စစ်ဆေးပြီး ဆက်သွယ်ပါမည်"); },
    onError: e => toast.error(e.message),
  });

  const isProgression = selectedGame.type === "progression";
  const ranks = selectedGame.id === "hok" ? HOK_RANKS : MLBB_RANKS;
  const servers = selectedGame.id === "wuwa" ? SERVERS_WUWA : SERVERS_GENSHIN;

  function toggleService(svc: string) {
    setSelectedServices(prev => prev.includes(svc) ? prev.filter(s => s !== svc) : [...prev, svc]);
  }

  function handleSubmit() {
    createMut.mutate({
      gameType: selectedGame.id,
      serviceType: selectedGame.type as any,
      boostType: boostType,
      uid: form.uid || undefined,
      serverId: form.serverId || undefined,
      currentRank: form.currentRank || undefined,
      targetRank: form.targetRank || undefined,
      currentStars: form.currentStars || undefined,
      services: selectedServices.join(", ") || undefined,
      adventureRank: form.adventureRank || undefined,
      contact: form.contact || undefined,
      accountNote: form.accountNote || undefined,
      screenshotUrl: form.screenshotUrl || undefined,
      currentStars: selectedAddons.length > 0 ? `Addons: ${selectedAddons.join(", ")} | Stars: ${form.currentStars}` : form.currentStars || undefined,
    });
  }

  return (
    <StoreLayout>
      <div className="mx-auto max-w-lg space-y-5 pb-10">
        {/* Header */}
        <div className="text-center">
          <h1 className="font-display text-2xl font-extrabold">🏆 Boost & Progression Service</h1>
          <p className="mt-1 text-sm text-muted-foreground">Professional gaming service — fast & secure</p>
        </div>

        {/* Trust badges */}
        <div className="flex justify-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Zap className="size-3 text-yellow-400" /> Fast</span>
          <span className="flex items-center gap-1"><Shield className="size-3 text-green-400" /> Safe</span>
          <span className="flex items-center gap-1"><Star className="size-3 text-primary" /> Pro</span>
        </div>

        {/* My orders button */}
        {isAuthenticated && (
          <button onClick={() => setShowMyOrders(!showMyOrders)} className="w-full rounded-xl border border-border bg-card py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-all">
            {showMyOrders ? "▲ Orders ပိတ်မည်" : "📋 ကျွန်တော့် Orders ကြည့်မည်"}
          </button>
        )}

        {/* My orders list */}
        {showMyOrders && myOrders && (
          <div className="space-y-2">
            {myOrders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">Orders မရှိသေး</div>
            ) : myOrders.map((o: any) => {
              const statusInfo = STATUS_FLOW.find(s => s.key === o.status);
              return (
                <div key={o.id} className="rounded-2xl border border-border bg-card p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{GAMES.find(g => g.id === o.gameType)?.emoji} {o.gameType.toUpperCase()}</span>
                    <span className={`text-xs font-bold ${statusInfo?.color}`}>{statusInfo?.label ?? o.status}</span>
                  </div>
                  {/* Status progress bar */}
                  <div className="flex gap-0.5">
                    {STATUS_FLOW.slice(0,8).map((s,i) => {
                      const currentIdx = STATUS_FLOW.findIndex(st => st.key === o.status);
                      return <div key={s.key} className={`h-1 flex-1 rounded-full ${i <= currentIdx ? "bg-primary" : "bg-muted"}`} />;
                    })}
                  </div>
                  {o.serviceType === "rank_boost" && o.currentRank && (
                    <div className="text-xs text-muted-foreground">{o.currentRank} → {o.targetRank} | {o.boostType}</div>
                  )}
                  {o.serviceType === "progression" && o.services && (
                    <div className="text-xs text-muted-foreground">{o.services?.slice(0,60)}</div>
                  )}
                  {o.quotedPriceKs && (
                    <div className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs">
                      <span className="text-muted-foreground">Quoted: </span>
                      <span className="font-bold text-primary">{o.quotedPriceKs.toLocaleString()} Ks</span>
                      {o.depositPriceKs && <span className="ml-2 text-muted-foreground">(Deposit: {o.depositPriceKs.toLocaleString()} Ks)</span>}
                    </div>
                  )}
                  {o.progressNote && <p className="text-xs text-amber-400 border-t border-border pt-2">📊 {o.progressNote}</p>}
                  {o.adminNote && <p className="text-xs text-muted-foreground">💬 {o.adminNote}</p>}
                  <div className="text-[10px] text-muted-foreground">#{o.id} · {new Date(o.createdAt).toLocaleDateString()}</div>
                </div>
              );
            })}
          </div>
        )}

        {!submitted ? (
          <>
            {/* Game selector */}
            <div>
              <Label className="mb-2 block font-bold">🎮 Game ရွေးပါ</Label>
              <div className="grid grid-cols-2 gap-2">
                {GAMES.map(g => (
                  <button key={g.id} onClick={() => { setSelectedGame(g); setSelectedServices([]); }} className={`flex items-center gap-2 rounded-xl border p-3 text-sm font-semibold transition-all ${selectedGame.id === g.id ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"}`}>
                    <span className="text-xl">{g.emoji}</span>
                    <span>{g.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Service type badge */}
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${isProgression ? "bg-purple-500/20 text-purple-400" : "bg-amber-500/20 text-amber-400"}`}>
                {isProgression ? "✨ Progression Service" : "🏆 Rank Boost Service"}
              </span>
            </div>

            {/* Rank Boost form */}
            {!isProgression && (
              <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
                <h3 className="font-bold">📋 Rank Boost Details</h3>

                {/* Boost type */}
                <div>
                  <Label className="text-xs mb-2 block">Boost Type</Label>
                  <div className="flex gap-2">
                    {(["pilot","duo"] as const).map(t => (
                      <button key={t} onClick={() => setBoostType(t)} className={`flex-1 rounded-xl border py-2 text-sm font-bold transition-all ${boostType === t ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>
                        {t === "pilot" ? "🎮 Pilot (Login)" : "👥 Duo (Play Together)"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Game info */}
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">UID</Label><Input className="mt-1" placeholder="123456789" value={form.uid} onChange={e => setForm(f=>({...f,uid:e.target.value}))} /></div>
                  <div><Label className="text-xs">Server ID</Label><Input className="mt-1" placeholder="12345" value={form.serverId} onChange={e => setForm(f=>({...f,serverId:e.target.value}))} /></div>
                </div>

                {/* Rank selection */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Current Rank</Label>
                    <select className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" value={form.currentRank} onChange={e => setForm(f=>({...f,currentRank:e.target.value}))}>
                      <option value="">ရွေးပါ</option>
                      {ranks.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Target Rank</Label>
                    <select className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" value={form.targetRank} onChange={e => setForm(f=>({...f,targetRank:e.target.value}))}>
                      <option value="">ရွေးပါ</option>
                      {ranks.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>

                <div><Label className="text-xs">Current Stars/Points (optional)</Label><Input className="mt-1" placeholder="e.g. 3 stars, 150 points" value={form.currentStars} onChange={e => setForm(f=>({...f,currentStars:e.target.value}))} /></div>

                {/* Add-ons */}
                <div>
                  <Label className="text-xs mb-2 block">⚡ Add-ons (optional)</Label>
                  <div className="flex flex-wrap gap-2">
                    {ADDONS.map(a => (
                      <button key={a.key} onClick={() => setSelectedAddons(prev => prev.includes(a.key) ? prev.filter(x=>x!==a.key) : [...prev,a.key])} className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${selectedAddons.includes(a.key)?"border-primary bg-primary/10 text-primary":"border-border text-muted-foreground"}`}>
                        {a.label} (+{a.pct}%)
                      </button>
                    ))}
                  </div>
                </div>

                {/* Auto price display */}
                {form.currentRank && form.targetRank && (() => {
                  const price = calcPrice(selectedGame.id, form.currentRank, form.targetRank, selectedAddons);
                  return price > 0 ? (
                    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold">🏆 {form.currentRank} → {form.targetRank}</span>
                        <span className="font-display text-xl font-extrabold text-primary">{price.toLocaleString()} Ks</span>
                      </div>
                      {selectedAddons.length > 0 && (
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          {(() => {
                            const base = (selectedGame.id === "hok" ? HOK_PRICES : MLBB_PRICES)[`${form.currentRank}_${form.targetRank}`] ?? 0;
                            return <>
                              <div className="flex justify-between"><span>Base price:</span><span>{base.toLocaleString()} Ks</span></div>
                              {selectedAddons.map(k => {
                                const a = ADDONS.find(x=>x.key===k)!;
                                return <div key={k} className="flex justify-between"><span>{a.label}:</span><span>+{Math.round(base*a.pct/100).toLocaleString()} Ks</span></div>;
                              })}
                            </>;
                          })()}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border px-3 py-2 text-xs text-muted-foreground text-center">
                      ဤ route အတွက် Admin မှ price quote ပေးပါမည်
                    </div>
                  );
                })()}

                {boostType === "pilot" && (
                  <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-3 text-xs text-amber-400">
                    ⚠️ Pilot service အတွက် Admin စစ်ဆေးပြီး account info တောင်းပါမည်
                  </div>
                )}
              </div>
            )}

            {/* Progression Service form */}
            {isProgression && (
              <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
                <h3 className="font-bold">📋 Progression Service Details</h3>

                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">UID</Label><Input className="mt-1" placeholder="123456789" value={form.uid} onChange={e => setForm(f=>({...f,uid:e.target.value}))} /></div>
                  <div>
                    <Label className="text-xs">Server</Label>
                    <select className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" value={form.serverId} onChange={e => setForm(f=>({...f,serverId:e.target.value}))}>
                      <option value="">ရွေးပါ</option>
                      {servers.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div><Label className="text-xs">Adventure Rank / Union Level</Label><Input className="mt-1" placeholder="AR 55 / UL 40" value={form.adventureRank} onChange={e => setForm(f=>({...f,adventureRank:e.target.value}))} /></div>

                {/* Service checkboxes */}
                <div>
                  <Label className="text-xs mb-2 block">Service Type ရွေးပါ (multiple)</Label>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {PROGRESSION_SERVICES.map(svc => (
                      <button key={svc} onClick={() => toggleService(svc)} className={`w-full rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-all ${selectedServices.includes(svc) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}>
                        {selectedServices.includes(svc) ? "✅" : "☐"} {svc}
                      </button>
                    ))}
                  </div>
                  {selectedServices.length > 0 && <p className="mt-1 text-[10px] text-primary">{selectedServices.length} service(s) ရွေးထားပြီ</p>}
                </div>

                <div>
                  <Label className="text-xs">Screenshot Link (Current Progress)</Label>
                  <Input className="mt-1" placeholder="Google Drive / Telegram link" value={form.screenshotUrl} onChange={e => setForm(f=>({...f,screenshotUrl:e.target.value}))} />
                </div>
              </div>
            )}

            {/* Contact + Note */}
            <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
              <h3 className="font-bold text-sm">📞 Contact & Note</h3>
              <div><Label className="text-xs">Contact (Telegram / Discord / Facebook)</Label><Input className="mt-1" placeholder="@username" value={form.contact} onChange={e => setForm(f=>({...f,contact:e.target.value}))} /></div>
              <div>
                <Label className="text-xs">Additional Note</Label>
                <Textarea className="mt-1 text-xs" placeholder="ထပ်မံမှာကြားချင်သည်..." rows={2} value={form.accountNote} onChange={e => setForm(f=>({...f,accountNote:e.target.value}))} />
              </div>
            </div>

            {/* Pricing note */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs space-y-1">
              <p className="font-bold text-primary">💰 Pricing Flow</p>
              <p className="text-muted-foreground">1. Order တင် → Admin စစ်ဆေး</p>
              <p className="text-muted-foreground">2. Price quote ပေးမည် (Full / 50% Deposit)</p>
              <p className="text-muted-foreground">3. Confirm ဖြစ်ရင် → Service စတင်</p>
            </div>

            {/* Submit */}
            {!isAuthenticated ? (
              <a href={getLoginUrl()} className="block w-full rounded-xl bg-gradient-to-r from-primary to-accent py-3 text-center font-bold text-white">Login ဝင်ပြီး Order မည်</a>
            ) : (
              <Button onClick={handleSubmit} disabled={createMut.isPending || (!isProgression && (!form.currentRank || !form.targetRank)) || (isProgression && selectedServices.length === 0)} className="w-full bg-gradient-to-r from-primary to-accent font-bold py-3">
                {createMut.isPending ? "တင်နေသည်..." : "🚀 Order တင်မည်"}
              </Button>
            )}
          </>
        ) : (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center space-y-3">
            <div className="text-5xl">✅</div>
            <h3 className="font-bold text-lg text-emerald-400">Order တင်ပြီးပါပြီ!</h3>
            <p className="text-sm text-muted-foreground">Admin မှ စစ်ဆေးပြီး price quote ပေးပါမည်</p>
            <p className="text-xs text-muted-foreground">Telegram: @ShineAker</p>
            <button onClick={() => { setSubmitted(false); setSelectedServices([]); }} className="text-xs text-primary underline">နောက်ထပ် Order တင်မည်</button>
          </div>
        )}
      </div>
    </StoreLayout>
  );
}
