/**
 * Price conversion utilities for deposit flows.
 * Fetches the live TON/USD price and converts Myanmar Kyat (Ks) amounts into
 * the equivalent TON amount the user must send, using an admin-configured
 * USD->Ks exchange rate.
 */

const BINANCE_TICKER = "https://api.binance.com/api/v3/ticker/price?symbol=TONUSDT";
const COINGECKO = "https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd";

// Short in-memory cache to avoid hammering price APIs.
let cachedTonUsd: { price: number; at: number } | null = null;
const CACHE_TTL_MS = 60_000;

/** Clear the in-memory TON price cache (used in tests). */
export function resetTonPriceCache() {
  cachedTonUsd = null;
}

/**
 * Get the current TON price in USD. Tries Binance first, then CoinGecko.
 * Falls back to a conservative default if both fail.
 */
export async function getTonUsdPrice(): Promise<number> {
  if (cachedTonUsd && Date.now() - cachedTonUsd.at < CACHE_TTL_MS) {
    return cachedTonUsd.price;
  }

  // Try Binance public ticker.
  try {
    const res = await fetch(BINANCE_TICKER);
    if (res.ok) {
      const data = (await res.json()) as { price?: string };
      const price = Number(data.price);
      if (price > 0) {
        cachedTonUsd = { price, at: Date.now() };
        return price;
      }
    }
  } catch {
    // ignore, try next source
  }

  // Try CoinGecko.
  try {
    const res = await fetch(COINGECKO);
    if (res.ok) {
      const data = (await res.json()) as { "the-open-network"?: { usd?: number } };
      const price = data["the-open-network"]?.usd;
      if (price && price > 0) {
        cachedTonUsd = { price, at: Date.now() };
        return price;
      }
    }
  } catch {
    // ignore
  }

  // Last-resort fallback.
  return cachedTonUsd?.price ?? 3.0;
}

/**
 * Convert a Myanmar Kyat amount into the equivalent TON amount.
 * @param amountKs amount in Ks
 * @param usdToKs how many Ks per 1 USD (admin-configured)
 * @returns TON amount rounded to 4 decimals (string-friendly number)
 */
export async function ksToTon(amountKs: number, usdToKs: number): Promise<number> {
  const tonUsd = await getTonUsdPrice();
  const usd = amountKs / usdToKs;
  const ton = usd / tonUsd;
  // Round up slightly to 4 decimals so the user always sends enough.
  return Math.ceil(ton * 10000) / 10000;
}
