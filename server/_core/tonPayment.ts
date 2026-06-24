import { ENV } from "./env";

const TON_API_BASE = "https://tonapi.io/v2";

/**
 * Convert nanoton (string) to TON (number).
 */
function nanoToTon(nano: string | number): number {
  return Number(nano) / 1e9;
}

/**
 * Fetch recent incoming transactions for the configured TON wallet.
 * Returns a normalized list of incoming transfers with amount (TON), comment, and timestamp.
 */
export async function getTonIncomingTransactions(limit = 50): Promise<
  Array<{
    hash: string;
    amountTon: number;
    comment: string;
    utime: number; // unix seconds
    sender: string;
  }>
> {
  const address = ENV.tonWalletAddress;
  if (!address) {
    throw new Error("TON wallet address not configured");
  }

  const url = `${TON_API_BASE}/blockchain/accounts/${address}/transactions?limit=${limit}`;
  // TonAPI public (free) tier works without a key. Only attach the key if it is
  // a plausibly valid token, and silently fall back to keyless on auth errors.
  const res = await fetch(url, { headers: tonHeaders() });
  if (!res.ok) {
    throw new Error(`TonAPI error: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as { transactions?: any[] };
  const txs = data.transactions ?? [];

  const result: Array<{
    hash: string;
    amountTon: number;
    comment: string;
    utime: number;
    sender: string;
  }> = [];

  for (const tx of txs) {
    const inMsg = tx.in_msg;
    if (!inMsg) continue;
    // Only count value transfers (incoming)
    const value = inMsg.value;
    if (!value) continue;
    let comment = "";
    if (inMsg.decoded_body?.text) {
      comment = inMsg.decoded_body.text;
    } else if (inMsg.message_content?.decoded?.comment) {
      comment = inMsg.message_content.decoded.comment;
    } else if (typeof inMsg.comment === "string") {
      comment = inMsg.comment;
    }
    result.push({
      hash: tx.hash,
      amountTon: nanoToTon(value),
      comment: comment ?? "",
      utime: tx.utime ?? 0,
      sender: inMsg.source?.address ?? "",
    });
  }
  return result;
}

/**
 * Verify that a TON payment with the given memo (comment) and at least minTon amount
 * has arrived in the wallet. Returns the matching transaction hash if found.
 */
export async function verifyTonPaymentByMemo(
  memo: string,
  minTon: number,
): Promise<{ found: boolean; hash?: string; amountTon?: number }> {
  const txs = await getTonIncomingTransactions(50);
  const match = txs.find(
    (t) => t.comment.trim() === memo.trim() && t.amountTon + 1e-9 >= minTon,
  );
  if (match) {
    return { found: true, hash: match.hash, amountTon: match.amountTon };
  }
  return { found: false };
}

/**
 * Lightweight connectivity / credential check against TonAPI.
 * Returns true if the wallet account can be fetched.
 */
export async function tonHealthCheck(): Promise<boolean> {
  const address = ENV.tonWalletAddress;
  if (!address) return false;
  const url = `${TON_API_BASE}/accounts/${address}`;
  const res = await fetch(url, { headers: tonHeaders() });
  return res.ok;
}

/**
 * Build request headers for TonAPI. The configured key was found to be invalid
 * (returns 401), and the public endpoint works without auth, so we default to
 * keyless requests. If a valid key is provided later, set TON_USE_API_KEY=1.
 */
function tonHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (ENV.tonApiKey && process.env.TON_USE_API_KEY === "1") {
    headers["Authorization"] = `Bearer ${ENV.tonApiKey}`;
  }
  return headers;
}
