import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthUser = NonNullable<TrpcContext["user"]>;

function makeCtx(user: Partial<AuthUser> | null): TrpcContext {
  return {
    user: user
      ? ({
          id: 1,
          openId: "test-user",
          email: "t@example.com",
          name: "Tester",
          loginMethod: "manus",
          role: "user",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
          ...user,
        } as AuthUser)
      : undefined,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

describe("catalog.products", () => {
  it("returns an array of active products", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    const products = await caller.catalog.products();
    expect(Array.isArray(products)).toBe(true);
    // Every returned product must be active and have a known category.
    for (const p of products) {
      expect(p.isActive).toBe(true);
      expect(["popular", "premium", "other"]).toContain(p.category);
    }
  });
});

describe("catalog.productBySlug", () => {
  it("throws NOT_FOUND for a missing slug", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(caller.catalog.productBySlug({ slug: "does-not-exist-xyz" })).rejects.toThrow();
  });

  it("returns product with packages for a seeded slug", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    const result = await caller.catalog.productBySlug({ slug: "mobile-legends" });
    expect(result.product.slug).toBe("mobile-legends");
    expect(Array.isArray(result.packages)).toBe(true);
    expect(result.packages.length).toBeGreaterThan(0);
  });
});

describe("orders.create authorization", () => {
  it("rejects unauthenticated users", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(caller.orders.create({ packageId: 1 })).rejects.toThrow();
  });

  it("rejects an invalid package id", async () => {
    const caller = appRouter.createCaller(makeCtx({ id: 999999 }));
    await expect(caller.orders.create({ packageId: 999999 })).rejects.toThrow();
  });
});

describe("leaderboard.top", () => {
  it("returns a bounded list ordered by spend", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    const rows = await caller.leaderboard.top({ limit: 5 });
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].totalSpentKs).toBeGreaterThanOrEqual(rows[i].totalSpentKs);
    }
  });
});

describe("admin authorization", () => {
  it("forbids non-admin users from reading stats", async () => {
    const caller = appRouter.createCaller(makeCtx({ role: "user" }));
    await expect(caller.admin.stats()).rejects.toThrow();
  });
});

describe("spin prize table", () => {
  it("exposes prizes via status for authenticated users (shape check)", async () => {
    // We don't have a DB-backed user here, but the prize list is static and
    // should always contain the configured rewards plus a "Try Again".
    const caller = appRouter.createCaller(makeCtx({ id: 999998 }));
    const status = await caller.spin.status();
    expect(status.prizes.length).toBeGreaterThan(0);
    const labels = status.prizes.map(p => p.label);
    expect(labels).toContain("Try Again");
  });
});

describe("site.settings (public)", () => {
  it("returns site settings with a brand name", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    const settings = await caller.site.settings();
    expect(settings).toBeTruthy();
    expect(typeof settings?.brandName).toBe("string");
    expect((settings?.brandName ?? "").length).toBeGreaterThan(0);
  });
});

describe("site.banners (public)", () => {
  it("returns an array of active banners ordered by sortOrder", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    const banners = await caller.site.banners();
    expect(Array.isArray(banners)).toBe(true);
    for (let i = 1; i < banners.length; i++) {
      expect(banners[i - 1].sortOrder).toBeLessThanOrEqual(banners[i].sortOrder);
    }
  });
});

describe("admin Round 2 authorization", () => {
  it("forbids non-admin users from updating settings", async () => {
    const caller = appRouter.createCaller(makeCtx({ role: "user" }));
    await expect(caller.admin.updateSettings({ brandName: "Hacked" })).rejects.toThrow();
  });

  it("forbids non-admin users from creating a banner", async () => {
    const caller = appRouter.createCaller(makeCtx({ role: "user" }));
    await expect(
      caller.admin.createBanner({ title: "x", colorFrom: "#000", colorTo: "#111" }),
    ).rejects.toThrow();
  });

  it("forbids non-admin users from deleting a spin prize", async () => {
    const caller = appRouter.createCaller(makeCtx({ role: "user" }));
    await expect(caller.admin.deleteSpinPrize({ id: 1 })).rejects.toThrow();
  });

  it("forbids non-admin users from uploading an image", async () => {
    const caller = appRouter.createCaller(makeCtx({ role: "user" }));
    await expect(
      caller.admin.uploadImage({ dataUrl: "data:image/png;base64,iVBORw0KGgo=", folder: "logos" }),
    ).rejects.toThrow();
  });
});
