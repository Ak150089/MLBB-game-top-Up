import { useEffect, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

function generateFingerprint(): string {
  try {
    const data = [navigator.userAgent, navigator.language,
      screen.width + "x" + screen.height,
      String(new Date().getTimezoneOffset()),
      String(navigator.hardwareConcurrency || 0),
      String(screen.colorDepth)].join("|");
    let h = 0;
    for (let i = 0; i < data.length; i++) h = (Math.imul(31, h) + data.charCodeAt(i)) | 0;
    return Math.abs(h).toString(36);
  } catch { return "unknown"; }
}

export default function ReferralTracker() {
  const { isAuthenticated, user } = useAuth();
  const createReferral = trpc.referral.create.useMutation();
  const [done, setDone] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref && /^\d+$/.test(ref)) localStorage.setItem("pending_ref", ref);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user || done) return;
    const pendingRef = localStorage.getItem("pending_ref");
    if (!pendingRef) return;
    if (localStorage.getItem(`ref_done_${user.id}`)) {
      localStorage.removeItem("pending_ref");
      return;
    }
    createReferral.mutate(
      { referrerId: parseInt(pendingRef), deviceHash: generateFingerprint() },
      { onSettled: () => {
        localStorage.removeItem("pending_ref");
        localStorage.setItem(`ref_done_${user.id}`, "1");
        setDone(true);
      }}
    );
  }, [isAuthenticated, user, done]);

  return null;
}
