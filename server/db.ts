import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  balanceTransactions,
  deposits,
  heroBanners,
  InsertBalanceTransaction,
  InsertDeposit,
  InsertHeroBanner,
  InsertOrder,
  InsertPackage,
  InsertPaymentAccount,
  InsertProduct,
  InsertSiteSettings,
  InsertSpinPrize,
  InsertUser,
  orders,
  packages,
  paymentAccounts,
  products,
  siteSettings,
  spinPrizes,
  spins,
  userBalances,
  users,
  promoCodes,
  promoRedemptions,
  InsertPromoCode,
  InsertPromoRedemption,
  referrals,
  userCoupons,
  InsertReferral,
  InsertUserCoupon,
  supportMessages,
  InsertSupportMessage,
  reviews,
  InsertReview,
  stockItems,
  InsertStockItem,
  rankBoostOrders,
  gameAccountListings,
  InsertRankBoostOrder,
  InsertGameAccountListing,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

/* ----------------------------- Users / Auth ----------------------------- */

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/* ----------------------------- Products ----------------------------- */

export async function listActiveProducts() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(products)
    .where(eq(products.isActive, true))
    .orderBy(products.sortOrder, desc(products.topupCount));
}

export async function listAllProducts() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(products).orderBy(products.sortOrder, products.id);
}

export async function getProductBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(products).where(eq(products.slug, slug)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getProductById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createProduct(data: InsertProduct) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [res] = await db.insert(products).values(data).$returningId();
  return res;
}

export async function updateProduct(id: number, data: Partial<InsertProduct>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(products).set(data).where(eq(products.id, id));
}

export async function deleteProduct(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(packages).where(eq(packages.productId, id));
  await db.delete(products).where(eq(products.id, id));
}

/* ----------------------------- Packages ----------------------------- */

export async function listPackagesByProduct(productId: number, activeOnly = false) {
  const db = await getDb();
  if (!db) return [];
  const cond = activeOnly
    ? and(eq(packages.productId, productId), eq(packages.isActive, true))
    : eq(packages.productId, productId);
  return db.select().from(packages).where(cond).orderBy(packages.sortOrder, packages.priceKs);
}

export async function getPackageById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(packages).where(eq(packages.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createPackage(data: InsertPackage) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [res] = await db.insert(packages).values(data).$returningId();
  return res;
}

export async function updatePackage(id: number, data: Partial<InsertPackage>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(packages).set(data).where(eq(packages.id, id));
}

export async function deletePackage(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(packages).where(eq(packages.id, id));
}

/* ----------------------------- Orders ----------------------------- */

export async function createOrder(data: InsertOrder) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [res] = await db.insert(orders).values(data).$returningId();
  return res;
}

export async function listOrdersByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
}

export async function listAllOrders(statusFilter?: "pending" | "processing" | "completed" | "failed") {
  const db = await getDb();
  if (!db) return [];
  const q = db.select().from(orders);
  if (statusFilter) {
    return q.where(eq(orders.status, statusFilter)).orderBy(desc(orders.createdAt));
  }
  return q.orderBy(desc(orders.createdAt));
}

export async function getOrderById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/**
 * Update an order's status. When transitioning to "completed", increments the
 * buyer's totalSpentKs and the product's topupCount. Idempotent-ish: only
 * applies the spend increment when moving INTO completed from a non-completed state.
 */
export async function setOrderStatus(
  id: number,
  status: "pending" | "processing" | "completed" | "failed",
  adminNote?: string,
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const existing = await getOrderById(id);
  if (!existing) throw new Error("Order not found");

  await db
    .update(orders)
    .set({ status, adminNote: adminNote ?? existing.adminNote })
    .where(eq(orders.id, id));

  const wasCompleted = existing.status === "completed";
  const nowCompleted = status === "completed";

  if (!wasCompleted && nowCompleted) {
    await db
      .update(users)
      .set({ totalSpentKs: sql`${users.totalSpentKs} + ${existing.totalPriceKs}` })
      .where(eq(users.id, existing.userId));
    await db
      .update(products)
      .set({ topupCount: sql`${products.topupCount} + 1` })
      .where(eq(products.id, existing.productId));
  } else if (wasCompleted && !nowCompleted) {
    // Revert spend if an order is moved out of completed.
    await db
      .update(users)
      .set({ totalSpentKs: sql`GREATEST(${users.totalSpentKs} - ${existing.totalPriceKs}, 0)` })
      .where(eq(users.id, existing.userId));
  }

  // Refund prepaid balance if a balance-paid order is failed (and wasn't already failed).
  if (
    existing.paymentMethod === "balance" &&
    status === "failed" &&
    existing.status !== "failed"
  ) {
    await adjustBalance(
      existing.userId,
      existing.totalPriceKs,
      "refund",
      `Refund: order #${existing.id} failed`,
      existing.id,
    );
  }
}

export async function getOrderStats() {
  const db = await getDb();
  if (!db) {
    return { total: 0, pending: 0, processing: 0, completed: 0, failed: 0, revenueKs: 0 };
  }
  const rows = await db
    .select({
      status: orders.status,
      count: sql<number>`count(*)`,
      sumKs: sql<number>`coalesce(sum(${orders.totalPriceKs}), 0)`,
    })
    .from(orders)
    .groupBy(orders.status);

  const stats = { total: 0, pending: 0, processing: 0, completed: 0, failed: 0, revenueKs: 0 };
  for (const r of rows) {
    const count = Number(r.count);
    stats.total += count;
    stats[r.status as "pending" | "processing" | "completed" | "failed"] = count;
    if (r.status === "completed") stats.revenueKs += Number(r.sumKs);
  }
  return stats;
}

/* ----------------------------- Leaderboard ----------------------------- */

export async function getLeaderboard(limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ id: users.id, name: users.name, totalSpentKs: users.totalSpentKs })
    .from(users)
    .where(sql`${users.totalSpentKs} > 0`)
    .orderBy(desc(users.totalSpentKs))
    .limit(limit);
}

/* ----------------------------- Spin Wheel ----------------------------- */

export async function recordSpin(userId: number, prizeLabel: string, prizeValueKs: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(spins).values({ userId, prizeLabel, prizeValueKs });
  await db.update(users).set({ lastSpinAt: new Date() }).where(eq(users.id, userId));
  // Credit any cash prize directly into the user's prepaid balance.
  if (prizeValueKs > 0) {
    await adjustBalance(userId, prizeValueKs, "spin", `Spin reward: ${prizeLabel}`);
  }
}

export async function listSpinsByUser(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(spins)
    .where(eq(spins.userId, userId))
    .orderBy(desc(spins.spunAt))
    .limit(limit);
}

/* ----------------------------- Payment Accounts ----------------------------- */

export async function listPaymentAccounts(activeOnly = false) {
  const db = await getDb();
  if (!db) return [];
  const q = db.select().from(paymentAccounts);
  if (activeOnly) {
    return q.where(eq(paymentAccounts.isActive, true)).orderBy(paymentAccounts.sortOrder);
  }
  return q.orderBy(paymentAccounts.sortOrder);
}

export async function createPaymentAccount(data: InsertPaymentAccount) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [res] = await db.insert(paymentAccounts).values(data).$returningId();
  return res;
}

export async function updatePaymentAccount(id: number, data: Partial<InsertPaymentAccount>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(paymentAccounts).set(data).where(eq(paymentAccounts.id, id));
}

export async function deletePaymentAccount(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(paymentAccounts).where(eq(paymentAccounts.id, id));
}

/* ----------------------------- Site Settings ----------------------------- */

const DEFAULT_SETTINGS = {
  id: 1,
  brandName: "ShineAker",
  brandAccent: "Aker",
  logoUrl: null as string | null,
  tagline: "Top Up. Power Up. Win More.",
  taglineMy: "ဖြည့်လိုက်၊ အားဖြည့်လိုက်၊ ပိုနိုင်လိုက်။",
  contactEmail: "shineaker@gmail.com",
  usdToKs: 4500,
  updatedAt: new Date(),
};

export async function getSiteSettings() {
  const db = await getDb();
  if (!db) return DEFAULT_SETTINGS;
  const rows = await db.select().from(siteSettings).where(eq(siteSettings.id, 1)).limit(1);
  return rows.length > 0 ? rows[0] : DEFAULT_SETTINGS;
}

export async function updateSiteSettings(data: Partial<InsertSiteSettings>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  // Ensure the singleton row exists, then update.
  await db
    .insert(siteSettings)
    .values({ id: 1, ...data })
    .onDuplicateKeyUpdate({ set: data });
}

/* ----------------------------- Hero Banners ----------------------------- */

export async function listHeroBanners(activeOnly = false) {
  const db = await getDb();
  if (!db) return [];
  const q = db.select().from(heroBanners);
  if (activeOnly) {
    return q.where(eq(heroBanners.isActive, true)).orderBy(heroBanners.sortOrder, heroBanners.id);
  }
  return q.orderBy(heroBanners.sortOrder, heroBanners.id);
}

export async function createHeroBanner(data: InsertHeroBanner) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [res] = await db.insert(heroBanners).values(data).$returningId();
  return res;
}

export async function updateHeroBanner(id: number, data: Partial<InsertHeroBanner>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(heroBanners).set(data).where(eq(heroBanners.id, id));
}

export async function deleteHeroBanner(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(heroBanners).where(eq(heroBanners.id, id));
}

/* ----------------------------- Spin Prizes ----------------------------- */

export async function listSpinPrizes(activeOnly = false) {
  const db = await getDb();
  if (!db) return [];
  const q = db.select().from(spinPrizes);
  if (activeOnly) {
    return q.where(eq(spinPrizes.isActive, true)).orderBy(spinPrizes.sortOrder, spinPrizes.id);
  }
  return q.orderBy(spinPrizes.sortOrder, spinPrizes.id);
}

export async function createSpinPrize(data: InsertSpinPrize) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [res] = await db.insert(spinPrizes).values(data).$returningId();
  return res;
}

export async function updateSpinPrize(id: number, data: Partial<InsertSpinPrize>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(spinPrizes).set(data).where(eq(spinPrizes.id, id));
}

export async function deleteSpinPrize(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(spinPrizes).where(eq(spinPrizes.id, id));
}

/* ----------------------------- Balance / Wallet ----------------------------- */

/**
 * Get a user's prepaid balance in Ks. Returns 0 if no row exists yet.
 */
export async function getUserBalance(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.select().from(userBalances).where(eq(userBalances.userId, userId)).limit(1);
  return rows.length > 0 ? rows[0].balanceKs : 0;
}

/**
 * Atomically adjust a user's balance by amountKs (positive = credit, negative = debit)
 * and write a ledger row. Throws if the resulting balance would be negative.
 * Returns the new balance.
 */
export async function adjustBalance(
  userId: number,
  amountKs: number,
  type: "deposit" | "topup" | "spin" | "refund" | "adjust",
  description?: string,
  refId?: number,
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  // Ensure a balance row exists.
  await db
    .insert(userBalances)
    .values({ userId, balanceKs: 0 })
    .onDuplicateKeyUpdate({ set: { userId } });

  const current = await getUserBalance(userId);
  const next = current + amountKs;
  if (next < 0) {
    throw new Error("INSUFFICIENT_BALANCE");
  }

  await db.update(userBalances).set({ balanceKs: next }).where(eq(userBalances.userId, userId));
  await db.insert(balanceTransactions).values({
    userId,
    type,
    amountKs,
    balanceAfterKs: next,
    description: description ?? null,
    refId: refId ?? null,
  });
  return next;
}

export async function listBalanceTransactions(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(balanceTransactions)
    .where(eq(balanceTransactions.userId, userId))
    .orderBy(desc(balanceTransactions.createdAt))
    .limit(limit);
}

/* ----------------------------- Deposits ----------------------------- */

export async function createDeposit(data: InsertDeposit) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [res] = await db.insert(deposits).values(data).$returningId();
  return res;
}

export async function getDepositById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(deposits).where(eq(deposits.id, id)).limit(1);
  return rows.length > 0 ? rows[0] : undefined;
}

export async function getDepositByMemo(memo: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(deposits).where(eq(deposits.memo, memo)).limit(1);
  return rows.length > 0 ? rows[0] : undefined;
}

export async function listDepositsByUser(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(deposits)
    .where(eq(deposits.userId, userId))
    .orderBy(desc(deposits.createdAt))
    .limit(limit);
}

export async function listAllDeposits(statusFilter?: "pending" | "completed" | "failed") {
  const db = await getDb();
  if (!db) return [];
  const q = db.select().from(deposits);
  if (statusFilter) {
    return q.where(eq(deposits.status, statusFilter)).orderBy(desc(deposits.createdAt));
  }
  return q.orderBy(desc(deposits.createdAt));
}

export async function updateDeposit(id: number, data: Partial<InsertDeposit>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(deposits).set(data).where(eq(deposits.id, id));
}

/**
 * Mark a deposit completed and credit the user's balance (idempotent).
 * Only credits when transitioning from a non-completed state into completed.
 * Returns the new balance, or null if no credit was applied.
 */
export async function completeDeposit(
  id: number,
  txReference?: string,
  adminNote?: string,
): Promise<number | null> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const dep = await getDepositById(id);
  if (!dep) throw new Error("Deposit not found");
  if (dep.status === "completed") return null; // already credited

  await db
    .update(deposits)
    .set({
      status: "completed",
      txReference: txReference ?? dep.txReference,
      adminNote: adminNote ?? dep.adminNote,
    })
    .where(eq(deposits.id, id));

  return adjustBalance(dep.userId, dep.amountKs, "deposit", `Deposit via ${dep.method}`, dep.id);
}

export async function failDeposit(id: number, adminNote?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const dep = await getDepositById(id);
  if (!dep) throw new Error("Deposit not found");
  await db
    .update(deposits)
    .set({ status: "failed", adminNote: adminNote ?? dep.adminNote })
    .where(eq(deposits.id, id));
}

/* ----------------------------- Promo codes ----------------------------- */

export async function getPromoByCode(code: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(promoCodes).where(eq(promoCodes.code, code)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getPromoById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(promoCodes).where(eq(promoCodes.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function countUserRedemptions(promoId: number, userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select({ c: sql<number>`count(*)` })
    .from(promoRedemptions)
    .where(and(eq(promoRedemptions.promoId, promoId), eq(promoRedemptions.userId, userId)));
  return Number(rows[0]?.c ?? 0);
}

export async function recordRedemption(data: InsertPromoRedemption) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [res] = await db.insert(promoRedemptions).values(data).$returningId();
  return res;
}

export async function incrementPromoUse(promoId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(promoCodes).set({ usedCount: sql`${promoCodes.usedCount} + 1` }).where(eq(promoCodes.id, promoId));
}

export async function listPromos() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(promoCodes).orderBy(desc(promoCodes.createdAt));
}

export async function createPromo(data: InsertPromoCode) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [res] = await db.insert(promoCodes).values(data).$returningId();
  return res;
}

export async function updatePromo(id: number, data: Partial<InsertPromoCode>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(promoCodes).set(data).where(eq(promoCodes.id, id));
}

export async function deletePromo(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(promoCodes).where(eq(promoCodes.id, id));
}

/* ----------------------------- Referral system ----------------------------- */

export async function createReferral(data: InsertReferral) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [res] = await db.insert(referrals).values(data).$returningId();
  return res;
}
export async function getReferralByReferredId(referredId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(referrals).where(eq(referrals.referredId, referredId)).limit(1);
  return r[0];
}
export async function getReferralByDeviceHash(deviceHash: string) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(referrals).where(eq(referrals.deviceHash, deviceHash)).limit(1);
  return r[0];
}
export async function countReferralsByReferrer(referrerId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.select({ c: sql<number>`count(*)` }).from(referrals).where(eq(referrals.referrerId, referrerId));
  return Number(rows[0]?.c ?? 0);
}
export async function listMyReferrals(referrerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(referrals).where(eq(referrals.referrerId, referrerId)).orderBy(desc(referrals.createdAt));
}
export async function completeReferralReward(referredId: number): Promise<{ completed: boolean; referrerId: number | null }> {
  const db = await getDb();
  if (!db) return { completed: false, referrerId: null };
  const rows = await db.select({ c: sql<number>`count(*)` }).from(orders).where(and(eq(orders.userId, referredId), eq(orders.status, "completed")));
  if (Number(rows[0]?.c ?? 0) !== 1) return { completed: false, referrerId: null };
  const refRows = await db.select().from(referrals).where(and(eq(referrals.referredId, referredId), eq(referrals.status, "pending"))).limit(1);
  if (refRows.length === 0) return { completed: false, referrerId: null };
  const ref = refRows[0];
  await adjustBalance(ref.referrerId, 500, "referral", `Referral reward: user #${referredId} first order`);
  await db.update(referrals).set({ status: "completed", rewardPaidAt: new Date() }).where(eq(referrals.id, ref.id));
  return { completed: true, referrerId: ref.referrerId };
}

/* ----------------------------- User coupons ----------------------------- */

export async function collectCoupon(userId: number, promoId: number, source: "welcome" | "collect" | "referral") {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(userCoupons).values({ userId, promoId, source }).onDuplicateKeyUpdate({ set: { source } });
}
export async function getUserCoupons(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ id: userCoupons.id, source: userCoupons.source, collectedAt: userCoupons.collectedAt,
      code: promoCodes.code, discountType: promoCodes.discountType, discountValue: promoCodes.discountValue,
      isActive: promoCodes.isActive, expiresAt: promoCodes.expiresAt, minOrderKs: promoCodes.minOrderKs })
    .from(userCoupons)
    .innerJoin(promoCodes, eq(userCoupons.promoId, promoCodes.id))
    .where(eq(userCoupons.userId, userId))
    .orderBy(desc(userCoupons.collectedAt));
}
export async function listPublicPromos() {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  return db.select().from(promoCodes)
    .where(and(eq(promoCodes.isActive, true), sql`(${promoCodes.expiresAt} IS NULL OR ${promoCodes.expiresAt} > ${now})`))
    .orderBy(desc(promoCodes.discountValue));
}

/* ----------------------------- Support chat ----------------------------- */

export async function getSupportMessages(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(supportMessages).where(eq(supportMessages.userId, userId)).orderBy(supportMessages.createdAt);
}
export async function addSupportMessage(userId: number, role: "user" | "assistant" | "admin", content: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [res] = await db.insert(supportMessages).values({ userId, role, content }).$returningId();
  return res;
}
export async function getAllSupportConversations() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.execute(sql`SELECT sm.userId, u.name, u.email, (SELECT content FROM supportMessages WHERE userId = sm.userId ORDER BY createdAt DESC LIMIT 1) as lastMsg, (SELECT role FROM supportMessages WHERE userId = sm.userId ORDER BY createdAt DESC LIMIT 1) as lastRole, (SELECT createdAt FROM supportMessages WHERE userId = sm.userId ORDER BY createdAt DESC LIMIT 1) as lastAt, COUNT(*) as msgCount FROM supportMessages sm JOIN users u ON u.id = sm.userId GROUP BY sm.userId, u.name, u.email ORDER BY lastAt DESC`);
  return rows[0] as any[];
}
export async function deleteSupportMessages(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(supportMessages).where(eq(supportMessages.userId, userId));
}

/* ----------------------------- Reviews ----------------------------- */

export async function createReview(data: InsertReview) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [res] = await db.insert(reviews).values(data).$returningId();
  return res;
}
export async function getReviewByOrder(orderId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(reviews).where(eq(reviews.orderId, orderId)).limit(1);
  return r[0];
}
export async function listReviewsByProduct(productId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: reviews.id, rating: reviews.rating, comment: reviews.comment, createdAt: reviews.createdAt,
    userName: users.name,
  }).from(reviews).innerJoin(users, eq(reviews.userId, users.id))
    .where(eq(reviews.productId, productId)).orderBy(desc(reviews.createdAt));
}
export async function addSpinTicket(userId: number, count = 1) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(users).set({ spinTickets: sql`${users.spinTickets} + ${count}` }).where(eq(users.id, userId));
}
export async function useSpinTicket(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const user = await getUserById(userId);
  if (!user || (user.spinTickets ?? 0) < 1) return false;
  await db.update(users).set({ spinTickets: sql`${users.spinTickets} - 1` }).where(eq(users.id, userId));
  return true;
}

/* ----------------------------- Stock items ----------------------------- */

export async function addStockItem(data: InsertStockItem) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [res] = await db.insert(stockItems).values(data).$returningId();
  return res;
}

export async function listStockByProduct(productId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(stockItems).where(eq(stockItems.productId, productId)).orderBy(desc(stockItems.createdAt));
}

export async function countAvailableStock(productId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.select({ c: sql<number>`count(*)` }).from(stockItems)
    .where(and(eq(stockItems.productId, productId), eq(stockItems.isUsed, false)));
  return Number(rows[0]?.c ?? 0);
}

export async function deliverStockItem(productId: number, orderId: number): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const available = await db.select().from(stockItems)
    .where(and(eq(stockItems.productId, productId), eq(stockItems.isUsed, false)))
    .limit(1);
  if (available.length === 0) return null;
  const item = available[0];
  await db.update(stockItems).set({ isUsed: true, orderId, usedAt: new Date() }).where(eq(stockItems.id, item.id));
  await db.update(orders).set({ deliveredCredentials: item.credentials }).where(eq(orders.id, orderId));
  return item.credentials;
}

export async function deleteStockItem(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(stockItems).where(eq(stockItems.id, id));
}

/* ----------------------------- Rank Boost ----------------------------- */
export async function createRankBoostOrder(data: InsertRankBoostOrder) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [res] = await db.insert(rankBoostOrders).values(data).$returningId();
  return res;
}
export async function listRankBoostOrders(userId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (userId) return db.select().from(rankBoostOrders).where(eq(rankBoostOrders.userId, userId)).orderBy(desc(rankBoostOrders.createdAt));
  return db.select().from(rankBoostOrders).orderBy(desc(rankBoostOrders.createdAt));
}
export async function updateRankBoostOrder(id: number, data: Partial<InsertRankBoostOrder>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(rankBoostOrders).set(data as any).where(eq(rankBoostOrders.id, id));
}

/* ----------------------------- Game Account Listings ----------------------------- */
export async function createGameAccountListing(data: InsertGameAccountListing) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [res] = await db.insert(gameAccountListings).values(data).$returningId();
  return res;
}
export async function listGameAccountListings(status?: string) {
  const db = await getDb();
  if (!db) return [];
  if (status) return db.select().from(gameAccountListings).where(eq(gameAccountListings.status, status as any)).orderBy(desc(gameAccountListings.createdAt));
  return db.select().from(gameAccountListings).orderBy(desc(gameAccountListings.createdAt));
}
export async function getGameAccountListing(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(gameAccountListings).where(eq(gameAccountListings.id, id)).limit(1);
  return r[0];
}
export async function updateGameAccountListing(id: number, data: Partial<InsertGameAccountListing>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(gameAccountListings).set(data).where(eq(gameAccountListings.id, id));
}
