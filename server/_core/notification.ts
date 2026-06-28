// Telegram owner-notification (Manus Forge အစား)
// notifyOwner({ title, content }) → သင့် Telegram chat ဆီ ပို့
export type NotificationPayload = {
  title: string;
  content: string;
};

const TOKEN = process.env.TELEGRAM_ALERT_TOKEN ?? "";
const CHAT_ID = process.env.TELEGRAM_ALERT_CHAT_ID ?? "";

/**
 * order/deposit ဖြစ်ရင် owner (admin) ဆီ Telegram alert ပို့တယ်။
 * Return: true = ပို့အောင်မြင်၊ false = config မရှိ/ပို့မရ (caller က .catch ထားလို့ app မရပ်)
 */
export async function notifyOwner(
  payload: NotificationPayload,
): Promise<boolean> {
  const title = (payload.title ?? "").trim();
  const content = (payload.content ?? "").trim();

  if (!TOKEN || !CHAT_ID) {
    console.warn("[Notification] TELEGRAM_ALERT_TOKEN / CHAT_ID not configured");
    return false;
  }

  const text = title ? `${title}\n\n${content}` : content;

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text,
          disable_web_page_preview: true,
        }),
      },
    );
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(`[Notification] Telegram failed (${response.status}): ${detail}`);
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling Telegram:", error);
    return false;
  }
}
