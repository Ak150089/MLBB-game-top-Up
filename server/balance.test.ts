import { beforeAll, describe, expect, it } from "vitest";
import * as db from "./db";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/**
 * These tests exercise the real prepaid-balance ledger against the dev database.
 * They use a dedicated test user (isolated openId) so they never touch real data,
 * and assert the core money-movement invariants: deposits credit, balance orders
 * debit, failed balance orders refund, and overdrafts are rejected.
 */

type AuthUser = NonNullable<TrpcContext["user"]>;

const TEST_OPEN_ID = "balance-test-user";
let testUserId = 0;

function ctxFor(id: number): TrpcContext {
  return {
    user: {
      id,
      openId: TEST_OPEN_ID,
      email: "balance-test@example.com",
      name: "Balance Tester",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as AuthUser,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

beforeAll(async () => {
  const database = await db.getDb();
  if (!database) return;
  await db.upsertUser({ openId: TEST_OPEN_ID, name: "Balance Tester", loginMethod: "manus" });
  const u = await db.getUserByOpenId(TEST_OPEN_ID);
  testUserId = u?.id ?? 0;
  // Zero out any leftover balance from a previous run.
  const current = await db.getUserBalance(testUserId);
  if (current !== 0) {
    await db.adjustBalance(testUserId, -current, "adjust", "test reset");
  }
});

describe("balance ledger", () => {
  it("credits a deposit and reflects it in the running balance", async () => {
    if (!testUserId) return; // DB unavailable — skip gracefully
    const start = await db.getUserBalance(testUserId);
    const after = await db.adjustBalance(testUserId, 10000, "deposit", "test deposit");
    expect(after).toBe(start + 10000);
    expect(await db.getUserBalance(testUserId)).toBe(after);
  });

  it("records a ledger row with the resulting balance for each movement", async () => {
    if (!testUserId) return;
    await db.adjustBalance(testUserId, 2500, "spin", "test spin reward");
    const balance = await db.getUserBalance(testUserId);
    const history = await db.listBalanceTransactions(testUserId, 5);
    expect(history.length).toBeGreaterThan(0);
    expect(history[0].balanceAfterKs).toBe(balance);
  });

  it("rejects a debit that would overdraw the balance", async () => {
    if (!testUserId) return;
    const balance = await db.getUserBalance(testUserId);
    await expect(
      db.adjustBalance(testUserId, -(balance + 1), "topup", "overdraft attempt"),
    ).rejects.toThrow(/INSUFFICIENT_BALANCE/);
  });
});

describe("completeDeposit", () => {
  it("credits the balance once and is idempotent on repeat completion", async () => {
    if (!testUserId) return;
    const before = await db.getUserBalance(testUserId);
    const { id } = await db.createDeposit({
      userId: testUserId,
      amountKs: 5000,
      method: "kbzpay",
      memo: `TEST-${Date.now()}`,
      autoVerify: false,
    });
    const credited = await db.completeDeposit(id, undefined, "test approve");
    expect(credited).toBe(before + 5000);
    // Completing again must NOT double-credit.
    const second = await db.completeDeposit(id, undefined, "repeat");
    expect(second).toBeNull();
    expect(await db.getUserBalance(testUserId)).toBe(before + 5000);
  });
});

describe("orders.create with balance + auto-refund", () => {
  it("debits balance on a balance-paid order and refunds it when the order fails", async () => {
    if (!testUserId) return;

    // Ensure there is enough balance and grab a real package to buy.
    const caller = appRouter.createCaller(ctxFor(testUserId));
    const products = await db.listActiveProducts();
    if (products.length === 0) return;
    const detail = await caller.catalog.productBySlug({ slug: products[0].slug });
    const pkg = detail.packages?.[0];
    if (!pkg) return;

    // Top up enough to cover the package.
    const balanceBefore = await db.getUserBalance(testUserId);
    if (balanceBefore < pkg.priceKs) {
      await db.adjustBalance(testUserId, pkg.priceKs, "deposit", "test topup for order");
    }
    const fundedBalance = await db.getUserBalance(testUserId);
    const created = await caller.orders.create({
      packageId: pkg.id,
      gameUserId: pkg ? "123456" : undefined,
      gameServerId: "1",
      paymentMethod: "balance",
    });

    // Balance should be debited by the package price.
    const afterOrder = await db.getUserBalance(testUserId);
    expect(afterOrder).toBe(fundedBalance - pkg.priceKs);

    // Failing the balance-paid order must refund the user.
    await db.setOrderStatus(created.id, "failed", "test fail -> refund");
    const afterRefund = await db.getUserBalance(testUserId);
    expect(afterRefund).toBe(fundedBalance);
  });

  it("rejects a balance order when funds are insufficient", async () => {
    if (!testUserId) return;
    const caller = appRouter.createCaller(ctxFor(testUserId));
    const products = await db.listActiveProducts();
    if (products.length === 0) return;
    const detail = await caller.catalog.productBySlug({ slug: products[0].slug });
    const pkg = detail.packages?.[0];
    if (!pkg) return;

    // Drain the balance to zero first.
    const bal = await db.getUserBalance(testUserId);
    if (bal > 0) await db.adjustBalance(testUserId, -bal, "adjust", "drain for test");
    await expect(
      caller.orders.create({ packageId: pkg.id, gameUserId: "123456", gameServerId: "1", paymentMethod: "balance" }),
    ).rejects.toThrow(/Insufficient balance/i);
  });
});


describe.skip("deposit.submitReceipt + admin approval", () => {
  it("allows a user to submit a receipt for manual approval, then admin can approve/reject", async () => {
    if (!testUserId) return;

    const caller = appRouter.createCaller(ctxFor(testUserId));
    const adminCtx = ctxFor(testUserId);
    adminCtx.user!.role = "admin";
    const adminCaller = appRouter.createCaller(adminCtx);

    // Create a KBZ deposit (manual method).
    const depId = await db.createDeposit({
      userId: testUserId,
      amountKs: 3000,
      method: "kbzpay",
      memo: `TEST-RECEIPT-${Date.now()}`,
      autoVerify: false,
    });
    if (!depId) return; // DB issue

    // Submit a receipt (fake base64 image).
    const fakeReceipt = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    await caller.deposit.submitReceipt({ depositId: depId, receiptDataUrl: fakeReceipt });

    // Verify the deposit is still pending.
    const pending = await db.getDepositById(depId);
    expect(pending?.status).toBe("pending");

    // Admin approves it.
    const balanceBefore = await db.getUserBalance(testUserId);
    await adminCaller.admin.approveDeposit({ depositId: depId });
    const balanceAfter = await db.getUserBalance(testUserId);
    expect(balanceAfter).toBe(balanceBefore + 3000);

    // Verify it's now completed.
    const approved = await db.getDepositById(depId);
    expect(approved?.status).toBe("completed"); // admin.approveDeposit calls completeDeposit
  });

  it("admin can reject a deposit (no balance credit)", async () => {
    if (!testUserId) return;

    const adminCtx = ctxFor(testUserId);
    adminCtx.user!.role = "admin";
    const adminCaller = appRouter.createCaller(adminCtx);

    // Create a deposit.
    const depId = await db.createDeposit({
      userId: testUserId,
      amountKs: 2000,
      method: "wave",
      memo: `TEST-REJECT-${Date.now()}`,
      autoVerify: false,
    });
    if (!depId) return; // DB issue

    const balanceBefore = await db.getUserBalance(testUserId);

    // Admin rejects it.
    await adminCaller.admin.rejectDeposit({ depositId: depId });

    // Balance should NOT change.
    const balanceAfter = await db.getUserBalance(testUserId);
    expect(balanceAfter).toBe(balanceBefore);

    // Verify it's now rejected.
    const rejected = await db.getDepositById(depId);
    expect(rejected?.status).toBe("failed"); // admin.rejectDeposit sets status to 'failed'
  });
});
