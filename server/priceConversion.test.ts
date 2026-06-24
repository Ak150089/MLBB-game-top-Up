import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTonUsdPrice, ksToTon, resetTonPriceCache } from "./_core/priceConversion";

function mockFetchOnce(handler: (url: string) => Response | Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => handler(String(url))));
}

beforeEach(() => {
  resetTonPriceCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  resetTonPriceCache();
});

describe("getTonUsdPrice", () => {
  it("returns the Binance ticker price when available", async () => {
    mockFetchOnce(url => {
      if (url.includes("binance")) {
        return new Response(JSON.stringify({ price: "2.50" }), { status: 200 });
      }
      return new Response("{}", { status: 500 });
    });
    const price = await getTonUsdPrice();
    expect(price).toBeCloseTo(2.5, 5);
  });

  it("falls back to CoinGecko when Binance fails", async () => {
    mockFetchOnce(url => {
      if (url.includes("binance")) return new Response("err", { status: 500 });
      if (url.includes("coingecko")) {
        return new Response(JSON.stringify({ "the-open-network": { usd: 3.2 } }), { status: 200 });
      }
      return new Response("{}", { status: 500 });
    });
    const price = await getTonUsdPrice();
    expect(price).toBeCloseTo(3.2, 5);
  });
});

describe("ksToTon", () => {
  it("converts Ks to TON using usdToKs and live price, rounding up to 4 decimals", async () => {
    // Force a known TON price of $2 so math is deterministic.
    mockFetchOnce(url => {
      if (url.includes("binance")) {
        return new Response(JSON.stringify({ price: "2.00" }), { status: 200 });
      }
      return new Response("{}", { status: 500 });
    });

    // 10,000 Ks at 5,000 Ks/USD = $2 => at $2/TON = 1.0000 TON
    const ton = await ksToTon(10000, 5000);
    expect(ton).toBeCloseTo(1.0, 4);
  });

  it("never rounds the required TON amount down (user always sends enough)", async () => {
    mockFetchOnce(url => {
      if (url.includes("binance")) {
        return new Response(JSON.stringify({ price: "2.00" }), { status: 200 });
      }
      return new Response("{}", { status: 500 });
    });
    // 4,500 Ks at 4,500 Ks/USD = $1 => 0.5 TON exactly
    const ton = await ksToTon(4500, 4500);
    expect(ton).toBeGreaterThanOrEqual(0.5);
  });
});
