import { useLang } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Gift, ShieldCheck, Zap } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const AUTO_MS = 3500;
const SLIDE_PCT = 76; // active slide = 76% of container
const OFFSET_PCT = (100 - SLIDE_PCT) / 2; // 12% padding each side to center
const GAP_PX = 10;

const LAYERS = [
  { scale: 1,    opacity: 1,    blur: 0, sat: 1,   bright: 1    },
  { scale: 0.88, opacity: 0.58, blur: 0, sat: 0.7, bright: 0.6  },
  { scale: 0.76, opacity: 0.32, blur: 2, sat: 0.4, bright: 0.42 },
];

function getLayer(dist: number) {
  return LAYERS[Math.min(Math.abs(dist), 2)];
}

export default function HeroCarousel() {
  const { lang, t } = useLang();
  const { data: banners, isLoading } = trpc.site.banners.useQuery();
  const [idx, setIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const count = banners?.length ?? 0;

  const go = useCallback((next: number) => {
    if (count === 0) return;
    setIdx(((next % count) + count) % count);
  }, [count]);

  const resetAuto = useCallback(() => {
    clearInterval(timerRef.current!);
    timerRef.current = setInterval(() => setIdx(i => (i + 1) % count), AUTO_MS);
  }, [count]);

  useEffect(() => {
    if (count <= 1) return;
    resetAuto();
    return () => clearInterval(timerRef.current!);
  }, [count, resetAuto]);

  if (isLoading) return <Skeleton className="h-48 w-full rounded-3xl" />;

  if (count === 0) {
    return (
      <section className="relative overflow-hidden rounded-3xl border border-primary/30 p-6" style={{ background: "linear-gradient(135deg,#1a1060 0%,#2d1b8e 50%,#0f0a3c 100%)" }}>
        <div className="absolute -right-8 -top-10 size-52 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "repeating-linear-gradient(45deg,transparent,transparent 20px,rgba(255,255,255,0.8) 20px,rgba(255,255,255,0.8) 21px)" }} />
        <div className="relative flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-extrabold leading-tight text-white">{t("home.heroTitle")}</h1>
            <p className="mt-1.5 text-sm font-bold" style={{ color: "#4ade80" }}>{t("home.heroSub")}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] text-white/80"><Zap className="size-3 text-yellow-400" /> Fast</span>
              <span className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] text-white/80"><ShieldCheck className="size-3 text-green-400" /> Secure</span>
            </div>
          </div>
          <div className="shrink-0 text-5xl">🎮</div>
        </div>
      </section>
    );
  }

  // Pure CSS % translate — no pixel measurement needed
  // At idx=0: translateX(OFFSET_PCT%) → centers slide 0
  // At idx=N: translateX(OFFSET_PCT% - N*(SLIDE_PCT% + GAP))
  const translateX = `calc(${OFFSET_PCT}% - ${idx} * (${SLIDE_PCT}% + ${GAP_PX}px))`;

  return (
    <section className="relative w-full select-none">
      <div style={{ overflow: "hidden", width: "100%", position: "relative", padding: "18px 0 22px" }}>
        {/* Track */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: GAP_PX,
            transform: `translateX(${translateX})`,
            transition: "transform 540ms cubic-bezier(0.25,1,0.5,1)",
            willChange: "transform",
          }}
        >
          {banners!.map((b, i) => {
            const title = lang === "my" && b.titleMy ? b.titleMy : b.title;
            const subtitle = lang === "my" && b.subtitleMy ? b.subtitleMy : b.subtitle;
            const rawDist = i - idx;
            const dist = rawDist > count / 2 ? rawDist - count : rawDist < -count / 2 ? rawDist + count : rawDist;
            const layer = getLayer(dist);
            const isActive = dist === 0;
            return (
              <div
                key={b.id}
                onClick={() => { if (!isActive) { go(i); resetAuto(); } }}
                style={{
                  flexShrink: 0,
                  width: `${SLIDE_PCT}%`,
                  minWidth: `${SLIDE_PCT}%`,
                  borderRadius: 18,
                  overflow: "hidden",
                  cursor: isActive ? "default" : "pointer",
                  transition: "all 480ms cubic-bezier(0.25,1,0.5,1)",
                  transform: `scale(${layer.scale})`,
                  opacity: layer.opacity,
                  filter: `brightness(${layer.bright}) saturate(${layer.sat}) blur(${layer.blur}px)`,
                  boxShadow: isActive ? "0 20px 60px rgba(0,0,0,0.8),0 8px 24px rgba(0,0,0,0.4)" : "0 4px 16px rgba(0,0,0,0.35)",
                  zIndex: isActive ? 3 : Math.abs(dist) === 1 ? 2 : 1,
                  position: "relative",
                }}
              >
                <div
                  style={{
                    position: "relative",
                    height: 180,
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    padding: "20px 24px",
                    ...(b.imageUrl
                      ? { backgroundImage: `url(${b.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
                      : { background: `linear-gradient(135deg,${b.colorFrom ?? "#1a1060"} 0%,${b.colorTo ?? "#e91e8c"} 100%)` }),
                  }}
                >
                  <div style={{ position:"absolute", right:-40, top:-40, width:200, height:200, borderRadius:"50%", background:"rgba(255,255,255,0.08)", filter:"blur(40px)" }} />
                  <div style={{ position:"absolute", inset:0, opacity:0.055, backgroundImage:"repeating-linear-gradient(45deg,transparent,transparent 20px,rgba(255,255,255,0.8) 20px,rgba(255,255,255,0.8) 21px)" }} />
                  <div style={{ position:"absolute", inset:0, background:"linear-gradient(to right,rgba(0,0,0,0.55),rgba(0,0,0,0.12) 55%,transparent)" }} />
                  <div style={{ position:"relative", flex:1, minWidth:0 }}>
                    {b.badge && (
                      <span style={{ display:"inline-flex", alignItems:"center", gap:4, background:"linear-gradient(90deg,#e91e8c,#9c27b0)", color:"#fff", fontSize:10, fontWeight:800, padding:"3px 11px", borderRadius:999, marginBottom:8, boxShadow:"0 2px 8px rgba(0,0,0,0.3)" }}>
                        <Gift style={{width:10,height:10}} /> {b.badge}
                      </span>
                    )}
                    <div style={{ fontSize:20, fontWeight:900, color:"#fff", lineHeight:1.2, textShadow:"0 2px 12px rgba(0,0,0,0.5)" }}>{title}</div>
                    {subtitle && <div style={{ fontSize:13, fontWeight:800, color:"#4ade80", marginTop:4, textShadow:"0 1px 6px rgba(0,0,0,0.4)" }}>{subtitle}</div>}
                    <div style={{ display:"flex", gap:6, marginTop:10, flexWrap:"wrap" }}>
                      <span style={{ display:"flex", alignItems:"center", gap:4, borderRadius:999, background:"rgba(255,255,255,0.15)", padding:"3px 10px", fontSize:10, color:"#fff", backdropFilter:"blur(4px)" }}><Zap style={{width:10,height:10,color:"#fbbf24"}} /> Fast</span>
                      <span style={{ display:"flex", alignItems:"center", gap:4, borderRadius:999, background:"rgba(255,255,255,0.15)", padding:"3px 10px", fontSize:10, color:"#fff", backdropFilter:"blur(4px)" }}><ShieldCheck style={{width:10,height:10,color:"#4ade80"}} /> Secure</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Arrows */}
        {count > 1 && (<>
          <button onClick={() => { go(idx-1); resetAuto(); }} style={{ position:"absolute", left:4, top:"50%", transform:"translateY(-50%)", width:34, height:34, borderRadius:"50%", border:"none", background:"rgba(0,0,0,0.6)", color:"#fff", cursor:"pointer", display:"grid", placeItems:"center", backdropFilter:"blur(8px)", boxShadow:"0 2px 14px rgba(0,0,0,0.6)", zIndex:10 }}>
            <ChevronLeft style={{width:15,height:15}} />
          </button>
          <button onClick={() => { go(idx+1); resetAuto(); }} style={{ position:"absolute", right:4, top:"50%", transform:"translateY(-50%)", width:34, height:34, borderRadius:"50%", border:"none", background:"rgba(0,0,0,0.6)", color:"#fff", cursor:"pointer", display:"grid", placeItems:"center", backdropFilter:"blur(8px)", boxShadow:"0 2px 14px rgba(0,0,0,0.6)", zIndex:10 }}>
            <ChevronRight style={{width:15,height:15}} />
          </button>
        </>)}
      </div>

      {/* Dots */}
      {count > 1 && (
        <div style={{ display:"flex", justifyContent:"center", gap:6, marginTop:2 }}>
          {banners!.map((_,i) => (
            <button key={i} onClick={() => { go(i); resetAuto(); }} style={{ height:6, borderRadius:999, border:"none", padding:0, cursor:"pointer", transition:"all 320ms cubic-bezier(0.25,1,0.5,1)", width: i===idx ? 24 : 6, background: i===idx ? "#e91e8c" : "rgba(255,255,255,0.22)", boxShadow: i===idx ? "0 0 10px #e91e8c99" : "none" }} />
          ))}
        </div>
      )}
    </section>
  );
}
