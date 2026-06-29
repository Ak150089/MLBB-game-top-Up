import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import StoreLayout from "@/components/StoreLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { Bot, User, Shield, Send, Loader2, MessageCircle, Trash2 } from "lucide-react";

type Mode = "select" | "ai" | "admin";

function ChatBubble({ role, content, createdAt }: { role: string; content: string; createdAt: string | Date }) {
  const isUser = role === "user";
  const isAdmin = role === "admin";
  return (
    <div className={`flex gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs ${isUser ? "bg-primary text-white" : isAdmin ? "bg-emerald-500 text-white" : "bg-violet-500 text-white"}`}>
        {isUser ? <User className="size-3.5" /> : isAdmin ? <Shield className="size-3.5" /> : <Bot className="size-3.5" />}
      </div>
      <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm ${isUser ? "bg-primary text-white rounded-tr-sm" : "bg-card border border-border rounded-tl-sm"}`}>
        <p className="whitespace-pre-wrap leading-relaxed">{content}</p>
        <p className={`mt-1 text-[10px] ${isUser ? "text-white/60 text-right" : "text-muted-foreground"}`}>
          {new Date(createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          {isAdmin && <span className="ml-1 font-semibold text-emerald-400"> · Admin</span>}
          {role === "assistant" && <span className="ml-1 font-semibold text-violet-400"> · AI</span>}
        </p>
      </div>
    </div>
  );
}

export default function Help() {
  const { isAuthenticated } = useAuth();
  const [mode, setMode] = useState<Mode>("select");
  const [input, setInput] = useState("");

  // Auto-detect URL params: ?ref=RB1001&mode=admin
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    const urlMode = params.get("mode") as Mode | null;
    if (urlMode === "admin" || urlMode === "ai") {
      setMode(urlMode);
    }
    if (ref) {
      setInput(`Order #${ref} အကြောင်း မေးမြန်းလိုသည်`);
    }
  }, []);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages, refetch } = trpc.support.myMessages.useQuery(undefined, { enabled: isAuthenticated && mode !== "select", refetchInterval: mode === "admin" ? 5000 : false });
  const sendMut = trpc.support.send.useMutation({ onSuccess: () => { refetch(); setInput(""); } });

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  function handleSend() {
    if (!input.trim() || sendMut.isPending) return;
    sendMut.mutate({ content: input.trim(), mode: mode as "ai" | "admin" });
  }

  if (!isAuthenticated) return (
    <StoreLayout>
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <MessageCircle className="size-12 text-muted-foreground" />
        <h2 className="font-display text-xl font-bold">Help Center</h2>
        <p className="text-sm text-muted-foreground">Support ရရှိရန် Login ဝင်ပါ</p>
        <Button asChild className="bg-gradient-to-r from-primary to-accent font-semibold">
          <a href={getLoginUrl()}>Login ဝင်ရန်</a>
        </Button>
      </div>
    </StoreLayout>
  );

  return (
    <StoreLayout>
      <div className="mx-auto max-w-lg">
        <div className="mb-4 flex items-center gap-2">
          <MessageCircle className="size-5 text-primary" />
          <h1 className="font-display text-xl font-bold">Help Center</h1>
        </div>

        {mode === "select" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Support mode ရွေးပါ —</p>
            <button onClick={() => setMode("ai")} className="w-full rounded-2xl border border-violet-500/30 bg-violet-500/10 p-5 text-left transition-all hover:bg-violet-500/20 active:scale-[0.98]">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-violet-500 text-white"><Bot className="size-5" /></div>
                <div>
                  <p className="font-bold">🤖 AI Support</p>
                  <p className="text-xs text-muted-foreground">ချက်ချင်း ဖြေပေးသည် — 24/7</p>
                </div>
              </div>
            </button>
            <button onClick={() => setMode("admin")} className="w-full rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-left transition-all hover:bg-emerald-500/20 active:scale-[0.98]">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500 text-white"><Shield className="size-5" /></div>
                <div>
                  <p className="font-bold">💬 Admin Chat</p>
                  <p className="text-xs text-muted-foreground">Admin မှ တိုက်ရိုက် ဖြေပေးသည်</p>
                </div>
              </div>
            </button>
          </div>
        )}

        {mode !== "select" && (
          <div className="flex flex-col" style={{ height: "calc(100vh - 200px)" }}>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {mode === "ai" ? <Bot className="size-4 text-violet-400" /> : <Shield className="size-4 text-emerald-400" />}
                <span className="text-sm font-semibold">{mode === "ai" ? "AI Support" : "Admin Chat"}</span>
              </div>
              <button onClick={() => setMode("select")} className="text-xs text-muted-foreground hover:text-foreground">← ပြန်</button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 pb-2">
              {!messages || messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                  {mode === "ai" ? <Bot className="size-10 text-violet-400" /> : <Shield className="size-10 text-emerald-400" />}
                  <p className="text-sm text-muted-foreground">{mode === "ai" ? "AI Support မှ ကူညီပေးပါမည်" : "Admin မှ မကြာမီ ဖြေပေးပါမည်"}</p>
                  <p className="text-xs text-muted-foreground">မေးခွန်း ရိုက်ထည့်ပြီး Send နှိပ်ပါ</p>
                </div>
              ) : (
                messages.map(m => <ChatBubble key={m.id} role={m.role} content={m.content} createdAt={m.createdAt} />)
              )}
              <div ref={bottomRef} />
            </div>

            <div className="mt-3 flex gap-2 border-t border-border pt-3">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder={mode === "ai" ? "AI ကို မေးမြန်းပါ..." : "Admin ကို မေးမြန်းပါ..."}
                rows={2}
                className="flex-1 resize-none rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <Button onClick={handleSend} disabled={sendMut.isPending || !input.trim()} className="h-auto self-end bg-gradient-to-r from-primary to-accent px-4">
                {sendMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </Button>
            </div>
          </div>
        )}
      </div>
    </StoreLayout>
  );
}
