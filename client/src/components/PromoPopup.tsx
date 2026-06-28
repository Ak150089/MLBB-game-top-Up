import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { X, Copy, Check } from "lucide-react";

function useCountdown(totalSeconds: number) {
  const [t, setT] = useState(totalSeconds);
  useEffect(() => {
    const id = setInterval(() => setT(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);
  return [String(Math.floor(t / 3600)).padStart(2, "0"), String(Math.floor((t % 3600) / 60)).padStart(2, "0"), String(t % 60).padStart(2, "0")];
}

function EnvelopeStage({ onDone }: { onDone: () => void }) {
  const [lidOpen, setLidOpen] = useState(false);
  const [shake, setShake] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setShake(true), 200);
    const t2 = setTimeout(() => { setShake(false); setLidOpen(true); }, 1100);
    const t3 = setTimeout(onDone, 1900);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []); // run once on mount — onDone is stable enough
  return (
    <div className="flex flex-col items-center gap-5">
      <p className="text-sm font-semibold text-white/80 animate-pulse">🎁 သင့်အတွက် Special Coupons!</p>
      <div style={{ filter: "drop-shadow(0 12px 32px rgba(251,191,36,0.55))", animation: shake ? "shake 0.12s ease-in-out infinite" : "none" }}>
        <svg width="160" height="120" viewBox="0 0 160 120">
          <rect x="6" y="34" width="148" height="80" rx="10" fill="#FCD34D" />
          <polygon points="6,114 80,74 154,114" fill="#F59E0B" />
          <polygon points="6,34 6,114 80,74" fill="#FBBF24" />
          <polygon points="154,34 154,114 80,74" fill="#FBBF24" />
          <polygon points="6,34 154,34 80,78" fill={lidOpen ? "#FEF3C7" : "#F59E0B"} style={{ transformOrigin: "80px 34px", transform: lidOpen ? "perspective(400px) rotateX(-170deg)" : "perspective(400px) rotateX(0deg)", transition: "transform 0.55s cubic-bezier(.22,1,.36,1)" }} />
          {!lidOpen && <circle cx="80" cy="72" r="11" fill="#EF4444" />}
        </svg>
        {lidOpen && <div className="absolute left-1/2 text-4xl" style={{ bottom: "64px", transform: "translateX(-50%)", animation: "riseUp 0.55s cubic-bezier(.22,1,.36,1) 0.25s both" }}>🎁</div>}
      </div>
      <p className="text-xs text-white/50">ဖွင့်နေသည်...</p>
    </div>
  );
}

function CouponCard({ coupon, index, copied, onCopy }: { coupon: { id: number; code: string; discountType: string; discountValue: number }; index: number; copied: string | null; onCopy: (code: string) => void }) {
  const gradients = ["from-amber-400 to-orange-500", "from-violet-500 to-purple-600", "from-emerald-400 to-teal-500"];
  const g = gradients[index % gradients.length];
  const isCopied = copied === coupon.code;
  return (
    <div className="relative flex items-center gap-3 overflow-hidden rounded-2xl border-2 border-dashed border-amber-200 bg-white p-4 shadow" style={{ animation: `slideUp 0.45s cubic-bezier(.22,1,.36,1) ${index * 0.16}s both` }}>
      <div className={`absolute left-0 inset-y-0 w-2.5 bg-gradient-to-b ${g} rounded-l-xl`} />
      <div className="flex-1 min-w-0 pl-2">
        <span className={`text-2xl font-black bg-gradient-to-r ${g} bg-clip-text text-transparent`}>
          {coupon.discountType === "percent" ? `${coupon.discountValue}% OFF` : `${coupon.discountValue.toLocaleString()} Ks`}
        </span>
        <p className="mt-0.5 font-mono text-xs font-bold text-gray-600">{coupon.code}</p>
        <p className="text-[10px] text-gray-400">Checkout မှာ ရိုက်ထည့်ပါ</p>
      </div>
      <div className="flex shrink-0 flex-col items-center gap-2 pl-1">
        <div className="text-3xl">🎫</div>
        <button onClick={() => onCopy(coupon.code)} className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-white transition-all active:scale-95 bg-gradient-to-r ${isCopied ? "from-green-400 to-emerald-500" : g}`}>
          {isCopied ? <><Check className="size-3" />Copied</> : <><Copy className="size-3" />Copy</>}
        </button>
      </div>
    </div>
  );
}

export default function PromoPopup() {
  const { isAuthenticated } = useAuth();
  const [phase, setPhase] = useState<"hidden"|"envelope"|"cards"|"done">("hidden");
  const [copied, setCopied] = useState<string|null>(null);
  const [collected, setCollected] = useState(false);
  const { data: promos } = trpc.referral.listPublic.useQuery(undefined, { enabled: isAuthenticated });
  const collectMut = trpc.referral.collect.useMutation();
  const utils = trpc.useUtils();
  const [h, m, s] = useCountdown(12 * 3600 + 4 * 60 + 6);

  useEffect(() => {
    if (!isAuthenticated || !promos || promos.length === 0) return;
    if (sessionStorage.getItem("promo_popup_shown")) return;
    const t = setTimeout(() => setPhase("envelope"), 1500);
    return () => clearTimeout(t);
  }, [isAuthenticated, promos]);

  const handleCopy = useCallback((code: string) => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  async function handleCollect() {
    if (!promos) return;
    setCollected(true);
    for (const p of promos) await collectMut.mutateAsync({ promoId: p.id }).catch(() => {});
    await utils.referral.myCoupons.invalidate();
    sessionStorage.setItem("promo_popup_shown", "1");
    setTimeout(() => setPhase("done"), 800);
  }

  function handleClose() { sessionStorage.setItem("promo_popup_shown", "1"); setPhase("done"); }

  if (phase === "hidden" || phase === "done" || !promos || promos.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes slideUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        @keyframes popIn{from{opacity:0;transform:scale(0.82)}to{opacity:1;transform:scale(1)}}
        @keyframes riseUp{from{opacity:0;transform:translateX(-50%) translateY(18px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        @keyframes shake{0%,100%{transform:rotate(0)}25%{transform:rotate(-4deg)}75%{transform:rotate(4deg)}}
        @keyframes coinBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
      `}</style>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(5px)", animation: "fadeIn 0.3s ease-out" }} onClick={phase === "cards" ? handleClose : undefined}>
        <div onClick={e => e.stopPropagation()}>
          {phase === "envelope" && <div className="relative flex items-center justify-center" style={{ minHeight: 200 }}><EnvelopeStage onDone={() => setPhase("cards")} /></div>}
          {phase === "cards" && (
            <div className="relative w-full max-w-sm" style={{ animation: "popIn 0.4s cubic-bezier(.22,1,.36,1)" }}>
              {[{s:{bottom:"-20px",left:"-20px"},d:"0.2s"},{s:{bottom:"-20px",right:"-20px"},d:"0.4s"},{s:{top:"-16px",left:"28px"},d:"0.1s"},{s:{top:"-16px",right:"28px"},d:"0.6s"}].map((c,i)=>(
                <span key={i} className="absolute text-2xl select-none pointer-events-none" style={{...c.s,animation:`coinBounce 1.2s ease-in-out ${c.d} infinite`}}>🪙</span>
              ))}
              <button onClick={handleClose} className="absolute -top-3 -right-3 z-10 flex size-8 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur hover:bg-white/30 transition-colors"><X className="size-4" /></button>
              <div className="overflow-hidden rounded-3xl shadow-2xl" style={{ background: "linear-gradient(160deg,#FCD34D 0%,#F59E0B 100%)" }}>
                <div className="m-0.5 overflow-hidden rounded-[22px] bg-white">
                  <div style={{ background: "linear-gradient(90deg,#FCD34D,#F59E0B)" }} className="px-5 py-4 text-center">
                    <p className="font-bold text-amber-900 text-sm">🎁 ကိုယ်တော်အတွက် Special Coupons</p>
                    <div className="mt-2 flex items-center justify-center gap-1.5">
                      <span className="text-[11px] text-amber-800 font-medium">Countdown</span>
                      {[h,m,s].map((t,i)=><span key={i} className="rounded-md bg-gray-900 px-1.5 py-0.5 font-mono text-sm font-bold text-white tabular-nums">{t}</span>)}
                    </div>
                  </div>
                  <div className="space-y-2.5 p-3">
                    {promos.map((p,i)=><CouponCard key={p.id} coupon={p} index={i} copied={copied} onCopy={handleCopy}/>)}
                  </div>
                  <div className="px-4 pb-5 pt-1">
                    <p className="mb-2.5 text-center text-[11px] text-gray-400">Login ဝင်ပြီး coupons wallet ထဲ သိမ်းပါ</p>
                    <button onClick={handleCollect} disabled={collected} className="w-full rounded-xl py-3.5 font-bold text-white text-base transition-all active:scale-[0.98] disabled:opacity-80" style={{ background: collected ? "linear-gradient(90deg,#22c55e,#16a34a)" : "linear-gradient(90deg,#111827,#374151)" }}>
                      {collected ? "✅ Wallet ထဲ သိမ်းပြီး!" : "✊ Collect ALL"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
