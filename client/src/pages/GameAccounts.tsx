import { useState } from "react";
import StoreLayout from "@/components/StoreLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatKs } from "@/contexts/LanguageContext";
import UserImageUpload from "@/components/UserImageUpload";
import { X, Star } from "lucide-react";

const GAMES = [
  { id:"mlbb", label:"Mobile Legends", emoji:"⚔️" },
  { id:"pubg", label:"PUBG Mobile", emoji:"🔫" },
  { id:"hok", label:"Honor of Kings", emoji:"👑" },
  { id:"genshin", label:"Genshin Impact", emoji:"🌟" },
  { id:"wuwa", label:"Wuthering Waves", emoji:"🌊" },
  { id:"freefire", label:"Free Fire", emoji:"🔥" },
  { id:"other", label:"Other Game", emoji:"🎮" },
];

// -------- Account Detail + Buy Modal --------
function AccDetailModal({ acc, onClose }: { acc: any; onClose: () => void }) {
  const { isAuthenticated, user } = useAuth();
  const [step, setStep] = useState(0);
  const [method, setMethod] = useState("");
  const [contact, setContact] = useState("");
  const [receipt, setReceipt] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [orderId, setOrderId] = useState<number | null>(null);

  const skinImages: string[] = (() => { try { return JSON.parse(acc.skinImageUrls ?? "[]"); } catch { return []; } })();

  const { data: balance } = trpc.balance.get.useQuery(undefined, { enabled: isAuthenticated });
  const buyMut = trpc.gameAcc.buy.useMutation({
    onSuccess: (res) => {
      setOrderId(res.orderId);
      if (res.autoDelivered) setStep(5);
      else setStep(4);
    },
    onError: e => toast.error(e.message),
  });
  const reviewMut = trpc.review.submit.useMutation({
    onSuccess: () => { toast.success("Review တင်ပြီ! ကျေးဇူးတင်ပါသည်"); onClose(); },
    onError: e => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/85 p-3">
      {lightbox && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95" onClick={() => setLightbox(null)}>
          <img src={lightbox} className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain" />
        </div>
      )}
      <div className="relative my-4 w-full max-w-md rounded-3xl border border-white/10 bg-[#0d1117]">
        {/* Banner */}
        <div className="relative h-48 overflow-hidden rounded-t-3xl bg-gradient-to-br from-violet-950 to-blue-950">
          {(acc.profileImageUrl || skinImages[0]) && (
            <img src={acc.profileImageUrl ?? skinImages[0]} className="h-full w-full object-cover opacity-50" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d1117] via-transparent to-transparent" />
          <button onClick={onClose} className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-black/60 text-white border border-white/10">
            <X className="size-4" />
          </button>
          <div className="absolute bottom-4 left-4">
            <div className="text-xl font-black text-white">{acc.ign ?? "Unknown"}</div>
            <div className="text-sm font-bold text-violet-300">{acc.rank} · {acc.gameType}</div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {step === 0 && <>
            {/* Price + stats */}
            <div className="flex items-center justify-between">
              <div className="flex gap-2 flex-wrap">
                {acc.gameType?.includes("Legend") && (
                  <span className="rounded-full bg-blue-500/15 border border-blue-500/20 px-2.5 py-0.5 text-[11px] font-bold text-blue-300">🦸 Heroes</span>
                )}
                <span className="rounded-full bg-violet-500/15 border border-violet-500/20 px-2.5 py-0.5 text-[11px] font-bold text-violet-300">✨ Skins</span>
              </div>
              <div className="text-xl font-black text-violet-400">{formatKs(acc.adminSellPriceKs)}</div>
            </div>

            {/* Details */}
            <div className="rounded-2xl bg-white/5 p-4 space-y-2">
              <div className="text-[11px] text-muted-foreground">Account Details</div>
              <div className="text-sm text-slate-200 leading-relaxed">{acc.accountDetails}</div>
              {acc.loginMethod && <div className="text-[11px] text-muted-foreground">Login: <span className="text-slate-300">{acc.loginMethod}</span></div>}
            </div>

            {/* Skin gallery */}
            {skinImages.length > 0 && (
              <div>
                <div className="mb-2 text-[11px] text-muted-foreground">🎨 Skin Gallery</div>
                <div className="grid grid-cols-3 gap-2">
                  {skinImages.map((img, i) => (
                    <div key={i} onClick={() => setLightbox(img)} className="aspect-square cursor-pointer overflow-hidden rounded-xl border border-white/5">
                      <img src={img} className="h-full w-full object-cover hover:scale-110 transition-transform duration-200" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Buy button */}
            {!isAuthenticated ? (
              <a href={getLoginUrl()} className="block w-full rounded-2xl bg-gradient-to-r from-violet-600 to-blue-600 py-3.5 text-center text-sm font-black text-white">
                Login ဝင်ပြီး ဝယ်မည်
              </a>
            ) : (
              <Button onClick={() => setStep(1)} className="w-full rounded-2xl bg-gradient-to-r from-violet-600 to-blue-600 py-6 text-sm font-black shadow-lg shadow-violet-500/30">
                🛒 ဝယ်မည် — {formatKs(acc.adminSellPriceKs)}
              </Button>
            )}
          </>}

          {step === 1 && <>
            <div className="font-bold text-white">💳 Payment Method</div>
            <div>
              <Label className="text-xs">Contact / Telegram</Label>
              <Input className="mt-1" placeholder="@username သို့မဟုတ် Phone" value={contact} onChange={e => setContact(e.target.value)} />
            </div>
            <div className="space-y-2">
              {[
                ["balance", `💰 Balance (${formatKs(balance ?? 0)})`],
                ["kbzpay", "🏦 KBZ Pay"],
                ["wavepay", "🌊 Wave Pay"],
                ["ayapay", "💳 AYA Pay"],
              ].map(([m, label]) => (
                <button key={m} onClick={() => setMethod(m)}
                  className={cn("w-full flex items-center justify-between rounded-2xl border p-3.5 text-sm font-bold transition-all",
                    method === m ? "border-violet-500 bg-violet-500/15 text-violet-300" : "border-border text-muted-foreground hover:border-violet-400/40")}>
                  <span>{label}</span>
                  {method === m && <span>✓</span>}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(0)}>← Back</Button>
              <Button className="flex-[2] bg-gradient-to-r from-violet-600 to-blue-600 font-black"
                disabled={!method || !contact.trim()}
                onClick={() => method === "balance" ? buyMut.mutate({ listingId: acc.id, paymentMethod: method, contact }) : setStep(2)}>
                ဆက်လုပ်မည် →
              </Button>
            </div>
          </>}

          {step === 2 && <>
            <div className="font-bold text-white">📱 ငွေလွှဲပါ</div>
            <div className="rounded-2xl bg-white/5 p-4 text-center space-y-1">
              <div className="text-xs text-muted-foreground">{method.toUpperCase()} သို့</div>
              <div className="text-xl font-black text-white">09 791 890 162</div>
              <div className="text-xs text-muted-foreground">ShineAker</div>
              <div className="text-2xl font-black text-amber-400 mt-2">{formatKs(acc.adminSellPriceKs)}</div>
            </div>
            <div>
              <Label className="text-xs">📸 ငွေလွှဲ Screenshot</Label>
              <UserImageUpload value={receipt} onChange={setReceipt} folder="receipts" />
            </div>
            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs text-amber-400">
              ⏳ Admin စစ်ဆေးပြီး Account credentials ပေးပါမည် (15-30 မိနစ်)
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>← Back</Button>
              <Button className="flex-[2] bg-gradient-to-r from-violet-600 to-blue-600 font-black"
                disabled={buyMut.isPending}
                onClick={() => buyMut.mutate({ listingId: acc.id, paymentMethod: method, contact, receiptUrl: receipt ?? undefined })}>
                {buyMut.isPending ? "တင်နေသည်..." : "Submit Order ✓"}
              </Button>
            </div>
          </>}

          {step === 4 && <>
            <div className="text-center space-y-3 py-2">
              <div className="text-5xl">✅</div>
              <div className="font-black text-lg text-white">Order တင်ပြီးပါပြီ!</div>
              <div className="rounded-2xl bg-white/5 p-4 text-left space-y-1 text-xs">
                <div className="text-muted-foreground">Order Status</div>
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full bg-amber-400 animate-pulse" />
                  <span className="font-bold text-amber-400">Admin Review Pending...</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Admin စစ်ဆေးပြီး credentials ပေးပါမည်</p>
              <Button variant="outline" className="w-full" onClick={onClose}>ပိတ်မည်</Button>
            </div>
          </>}

          {step === 5 && <>
            <div className="text-center space-y-3 py-2">
              <div className="text-5xl">⚡</div>
              <div className="font-black text-lg text-emerald-400">Account Credentials ရပြီ!</div>
              <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-left space-y-2">
                <div className="text-xs text-muted-foreground">🔐 Account Info</div>
                <div className="font-mono text-sm text-white whitespace-pre-wrap">{acc.adminCredentials}</div>
              </div>
              <Button className="w-full bg-gradient-to-r from-violet-600 to-blue-600 font-black" onClick={() => setStep(6)}>
                ⭐ Review တင်မည်
              </Button>
            </div>
          </>}

          {step === 6 && <>
            <div className="font-bold text-white">⭐ Review တင်ပါ</div>
            <div className="flex justify-center gap-2">
              {[1,2,3,4,5].map(s => (
                <button key={s} onClick={() => setRating(s)}
                  className={cn("text-3xl transition-all", s <= rating ? "opacity-100 scale-110" : "opacity-30")}>
                  <Star className={cn("size-8", s <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />
                </button>
              ))}
            </div>
            <Textarea placeholder="Account အကြောင်း review ရေးပါ..." value={review} onChange={e => setReview(e.target.value)} rows={3} />
            <Button className="w-full bg-gradient-to-r from-violet-600 to-blue-600 font-black"
              disabled={!rating || reviewMut.isPending}
              onClick={() => orderId && reviewMut.mutate({ orderId, rating, comment: review })}>
              Submit Review ⭐
            </Button>
          </>}
        </div>
      </div>
    </div>
  );
}

// -------- Account Card --------
function AccCard({ acc, onClick }: { acc: any; onClick: () => void }) {
  const skinImages: string[] = (() => { try { return JSON.parse(acc.skinImageUrls ?? "[]"); } catch { return []; } })();
  const thumb = acc.profileImageUrl ?? skinImages[0] ?? null;

  return (
    <button onClick={onClick} className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/5 bg-[#0d1117] text-left transition-all duration-200 hover:-translate-y-1 hover:border-violet-500/40 hover:shadow-lg hover:shadow-violet-500/15">
      {/* Image */}
      <div className="relative h-40 w-full overflow-hidden bg-gradient-to-br from-violet-950 to-blue-950">
        {thumb && <img src={thumb} className="h-full w-full object-cover opacity-50 transition-transform duration-300 group-hover:scale-105" />}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d1117] via-transparent to-transparent" />
        <div className="absolute right-2 top-2 rounded-full border border-white/10 bg-black/60 px-2.5 py-0.5 text-[10px] text-slate-400">{acc.gameType}</div>
        {acc.rank && (
          <div className="absolute left-2 top-2 rounded-full bg-violet-600/80 px-2.5 py-0.5 text-[10px] font-bold text-white">{acc.rank}</div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-black text-sm text-white">{acc.ign ?? "Account"}</div>
            <div className="text-[11px] text-muted-foreground">{acc.gameType}</div>
          </div>
          <div className="shrink-0 font-black text-sm text-violet-400">{formatKs(acc.adminSellPriceKs)}</div>
        </div>
        {acc.accountDetails && (
          <div className="line-clamp-2 text-[11px] leading-relaxed text-slate-400">{acc.accountDetails}</div>
        )}
        <div className="mt-auto rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 py-2 text-center text-xs font-black text-white opacity-90 group-hover:opacity-100">
          Details ကြည့်မည် →
        </div>
      </div>
    </button>
  );
}

// -------- Sell Form --------
function SellForm() {
  const { isAuthenticated } = useAuth();
  const [step, setStep] = useState(0);
  const [game, setGame] = useState("");
  const [profileUrl, setProfileUrl] = useState<string | null>(null);
  const [skinUrls, setSkinUrls] = useState<string[]>([]);
  const [form, setForm] = useState({ ign:"", uid:"", rank:"", loginMethod:"", accountDetails:"", sellerPriceKs:"" });
  const [submitted, setSubmitted] = useState(false);

  const createMut = trpc.gameAcc.submit.useMutation({
    onSuccess: () => setSubmitted(true),
    onError: e => toast.error(e.message),
  });

  if (!isAuthenticated) return (
    <div className="rounded-2xl border border-dashed border-border py-12 text-center space-y-3">
      <p className="text-muted-foreground text-sm">Account ရောင်းရန် Login ဝင်ပါ</p>
      <a href={getLoginUrl()} className="inline-block rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-6 py-2.5 text-sm font-bold text-white">Login မည်</a>
    </div>
  );

  if (submitted) return (
    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-8 text-center space-y-3">
      <div className="text-5xl">🎉</div>
      <div className="font-black text-lg text-white">Submit ပြီးပါပြီ!</div>
      <p className="text-sm text-muted-foreground">Admin စစ်ဆေးပြီး ကိုယ်ကိုဆက်သွယ်ပါမည်</p>
      <Button variant="outline" onClick={() => { setSubmitted(false); setStep(0); setGame(""); setForm({ ign:"",uid:"",rank:"",loginMethod:"",accountDetails:"",sellerPriceKs:"" }); }}>
        ထပ်တင်မည်
      </Button>
    </div>
  );

  return (
    <div className="mx-auto max-w-md space-y-5">
      {/* Progress */}
      <div className="flex gap-1">
        {["Game","Info","Images","Price"].map((s,i) => (
          <div key={s} className={cn("h-1 flex-1 rounded-full", i <= step ? "bg-violet-500" : "bg-muted")} />
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-4">
          <div className="font-bold text-white">🎮 Game ရွေးပါ</div>
          <div className="grid grid-cols-2 gap-2">
            {GAMES.map(g => (
              <button key={g.id} onClick={() => setGame(g.id)}
                className={cn("flex items-center gap-2 rounded-2xl border p-3.5 text-sm font-bold transition-all",
                  game === g.id ? "border-violet-500 bg-violet-500/15 text-violet-300" : "border-border text-muted-foreground hover:border-violet-400/40")}>
                <span className="text-lg">{g.emoji}</span><span>{g.label}</span>
              </button>
            ))}
          </div>
          <Button className="w-full bg-gradient-to-r from-violet-600 to-blue-600 font-black" disabled={!game} onClick={() => setStep(1)}>
            ဆက်လုပ်မည် →
          </Button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <div className="font-bold text-white">📋 Account Info</div>
          {[["IGN","In-game name","ign"],["UID","Player ID","uid"],["Rank","Mythic / Conqueror","rank"],["Login Method","Moonton / Google / Facebook","loginMethod"]].map(([label,ph,key]) => (
            <div key={key}>
              <Label className="text-xs">{label}</Label>
              <Input className="mt-1" placeholder={ph} value={(form as any)[key]} onChange={e => setForm(f => ({...f,[key]:e.target.value}))} />
            </div>
          ))}
          <div>
            <Label className="text-xs">Account Details</Label>
            <Textarea className="mt-1 text-xs" rows={3} placeholder="Heroes, Skins, Special items, UC spent..." value={form.accountDetails} onChange={e => setForm(f => ({...f,accountDetails:e.target.value}))} />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setStep(0)}>← Back</Button>
            <Button className="flex-[2] bg-gradient-to-r from-violet-600 to-blue-600 font-black" onClick={() => setStep(2)}>ဆက်လုပ်မည် →</Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="font-bold text-white">📸 Screenshots Upload</div>
          <div>
            <Label className="text-xs">Profile / Ingame Screenshot</Label>
            <UserImageUpload value={profileUrl} onChange={setProfileUrl} folder="game-accounts" />
          </div>
          <div>
            <Label className="text-xs">Skin Screenshots (Up to 6)</Label>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {[0,1,2,3,4,5].map(i => (
                <div key={i} className="aspect-square">
                  {skinUrls[i] ? (
                    <div className="relative h-full">
                      <img src={skinUrls[i]} className="h-full w-full rounded-xl object-cover" />
                      <button onClick={() => setSkinUrls(u => u.filter((_,j) => j !== i))} className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-red-500 text-white text-[10px]">×</button>
                    </div>
                  ) : i === skinUrls.length ? (
                    <UserImageUpload value={null} onChange={url => url && setSkinUrls(u => [...u, url])} folder="game-accounts" />
                  ) : (
                    <div className="h-full rounded-xl border border-dashed border-border" />
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>← Back</Button>
            <Button className="flex-[2] bg-gradient-to-r from-violet-600 to-blue-600 font-black" onClick={() => setStep(3)}>ဆက်လုပ်မည် →</Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="font-bold text-white">💰 ဈေးနှုန်းသတ်မှတ်ပါ</div>
          <div>
            <Label className="text-xs">ရောင်းချင်တဲ့ ဈေး (Ks)</Label>
            <Input className="mt-1 text-lg font-black" type="number" placeholder="150000" value={form.sellerPriceKs} onChange={e => setForm(f => ({...f,sellerPriceKs:e.target.value}))} />
          </div>
          {form.sellerPriceKs && parseInt(form.sellerPriceKs) > 0 && (
            <div className="rounded-2xl bg-violet-500/10 border border-violet-500/20 p-4 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">သင့် ဈေး</span>
                <span className="font-bold text-white">{parseInt(form.sellerPriceKs).toLocaleString()} Ks</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Admin ဝယ်မည် (80%)</span>
                <span className="font-bold text-violet-400">{Math.floor(parseInt(form.sellerPriceKs)*0.8).toLocaleString()} Ks</span>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>← Back</Button>
            <Button className="flex-[2] bg-gradient-to-r from-violet-600 to-blue-600 font-black"
              disabled={!form.sellerPriceKs || createMut.isPending}
              onClick={() => createMut.mutate({
                gameType: GAMES.find(g=>g.id===game)?.label ?? game,
                ign: form.ign || undefined,
                uid: form.uid || undefined,
                rank: form.rank || undefined,
                loginMethod: form.loginMethod || undefined,
                accountDetails: form.accountDetails || undefined,
                screenshotUrl: profileUrl ?? undefined,
                skinImageUrls: skinUrls.length > 0 ? JSON.stringify(skinUrls) : undefined,
                sellerPriceKs: parseInt(form.sellerPriceKs),
              })}>
              {createMut.isPending ? "တင်နေသည်..." : "🚀 Submit"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// -------- Main Page --------
export default function GameAccounts() {
  const [tab, setTab] = useState<"browse"|"sell">("browse");
  const [detail, setDetail] = useState<any>(null);
  const { data: listings } = trpc.gameAcc.listPublic.useQuery();

  return (
    <StoreLayout>
      {detail && <AccDetailModal acc={detail} onClose={() => setDetail(null)} />}
      <div className="mx-auto max-w-2xl space-y-5 pb-10">
        {/* Header */}
        <div className="text-center">
          <h1 className="font-display text-2xl font-black">💼 Game Account Market</h1>
          <p className="mt-1 text-sm text-muted-foreground">Verified accounts • Instant delivery available</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-2xl bg-white/5 p-1">
          <button onClick={() => setTab("browse")} className={cn("flex-1 rounded-xl py-2.5 text-sm font-bold transition-all", tab==="browse" ? "bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow" : "text-muted-foreground")}>
            🛒 Browse Accounts
          </button>
          <button onClick={() => setTab("sell")} className={cn("flex-1 rounded-xl py-2.5 text-sm font-bold transition-all", tab==="sell" ? "bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow" : "text-muted-foreground")}>
            + Sell Account
          </button>
        </div>

        {tab === "browse" && (
          !listings || listings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
              Accounts မရှိသေး
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {listings.map((acc: any) => (
                <AccCard key={acc.id} acc={acc} onClick={() => setDetail(acc)} />
              ))}
            </div>
          )
        )}

        {tab === "sell" && <SellForm />}
      </div>
    </StoreLayout>
  );
}
