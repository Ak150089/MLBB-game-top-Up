import { env } from "./env";

const ISTAR_API = "https://v1.fragmentapi.com/api/v1/partner";
const API_KEY = process.env.ISTAR_API_KEY ?? "";

export async function istarGetBalance() {
  const res = await fetch(`${ISTAR_API}/wallet/balance`, {
    headers: { "API-Key": API_KEY },
  });
  return res.json();
}

export async function istarSearchRecipient(username: string, months: 3 | 6 | 12) {
  const clean = username.replace("@", "");
  const res = await fetch(`${ISTAR_API}/premium/recipient/search?username=${clean}&months=${months}`, {
    headers: { "API-Key": API_KEY },
  });
  return res.json();
}

export async function istarBuyPremium(username: string, months: 3 | 6 | 12) {
  // Step 1: get recipient hash
  const recipient = await istarSearchRecipient(username, months);
  if (!recipient?.success) throw new Error(recipient?.message ?? "Recipient not found");

  // Step 2: buy premium
  const res = await fetch(`${ISTAR_API}/orders/premium`, {
    method: "POST",
    headers: { "API-Key": API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      username: username.replace("@", ""),
      recipient_hash: recipient.recipient,
      months,
      wallet_type: "TON",
    }),
  });
  return res.json();
}

export async function istarBuyStars(username: string, quantity: number) {
  // Step 1: get recipient hash
  const clean = username.replace("@", "");
  const recRes = await fetch(`${ISTAR_API}/star/recipient/search?username=${clean}&quantity=${quantity}`, {
    headers: { "API-Key": API_KEY },
  });
  const recipient = await recRes.json();
  if (!recipient?.success) throw new Error(recipient?.message ?? "Recipient not found");

  // Step 2: buy stars
  const res = await fetch(`${ISTAR_API}/orders/star`, {
    method: "POST",
    headers: { "API-Key": API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      username: clean,
      recipient_hash: recipient.recipient,
      quantity,
      wallet_type: "TON",
    }),
  });
  return res.json();
}
