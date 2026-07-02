import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { notifyOwner } from "./_core/notification";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { ksToTon } from "./_core/priceConversion";
import { verifyTonPaymentByMemo } from "./_core/tonPayment";
import { verifyReceipt } from "./_core/receiptOcr";
import { istarBuyPremium, istarBuyStars, istarGetBalance } from "./_core/telegramPremium";
import * as db from "./db";
import { storagePut } from "./storage";

const categoryEnum = z.enum(["popular", "premium", "other"]);
const statusEnum = z.enum(["pending", "processing", "completed", "failed"]);

/* ----------------------------- Spin Wheel config ----------------------------- */
const SPIN_COOLDOWN_MS = 24 * 60 * 60 * 1000;

type PrizeRow = { id: number; label: string; labelMy: string | null; valueKs: number; color: string; weight: number };

function pickPrize(prizes: PrizeRow[]) {
  const total = prizes.reduce((s, p) => s + Math.max(0, p.weight), 0);
  let r = Math.random() * total;
  for (let i = 0; i < prizes.length; i++) {
    r -= Math.max(0, prizes[i].weight);
    if (r <= 0) return { index: i, prize: prizes[i] };
  }
  return { index: prizes.length - 1, prize: prizes[prizes.length - 1] };
}

/* ----------------------------- Deposit helpers ----------------------------- */
const depositMethodEnum = z.enum(["ton", "binance", "kbzpay", "wavepay", "ayapay", "uabpay"]);
const AUTO_VERIFY_METHODS = new Set(["ton"]); // binance P2P has no public webhook -> admin approval

function generateMemo(): string {
  // Short, human-typeable, unique reference. e.g. SA-7F3K9Q
  const rand = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  return `SA-${rand}`;
}

/* ----------------------------- Image upload helper ----------------------------- */
async function uploadDataUrl(dataUrl: string, keyPrefix: string) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!match) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid image" });
  }
  const mime = match[1];
  const ext = mime.split("/")[1].replace("+xml", "");
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > 5 * 1024 * 1024) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Image too large (max 5MB)" });
  }
  const uploaded = await storagePut(`${keyPrefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`, buffer, mime);
  return uploaded;
}

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  /* ----------------------------- Catalog (public) ----------------------------- */
  catalog: router({
    products: publicProcedure.query(() => db.listActiveProducts()),
    productBySlug: publicProcedure.input(z.object({ slug: z.string() })).query(async ({ input }) => {
      const product = await db.getProductBySlug(input.slug);
      if (!product || !product.isActive) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
      }
      const pkgs = await db.listPackagesByProduct(product.id, true);
      return { product, packages: pkgs };
    }),
    paymentAccounts: publicProcedure.query(() => db.listPaymentAccounts(true)),
  }),

  /* ----------------------------- Orders ----------------------------- */
  orders: router({
    myOrders: protectedProcedure.query(({ ctx }) => db.listOrdersByUser(ctx.user.id)),

    create: protectedProcedure
      .input(
        z.object({
          packageId: z.number().int(),
          gameUserId: z.string().max(120).optional(),
          gameServerId: z.string().max(120).optional(),
          paymentMethod: z.string().max(60).optional(),
          promoCode: z.string().trim().max(40).optional(),
          // base64 data URL of the receipt image
          receiptDataUrl: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const pkg = await db.getPackageById(input.packageId);
        if (!pkg || !pkg.isActive) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Package not available" });
        }
        const product = await db.getProductById(pkg.productId);
        if (!product || !product.isActive) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Product not available" });
        }
        if (product.needsUserId && !input.gameUserId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Game User ID is required" });
        }
        if (product.needsServerId && !input.gameServerId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Server ID is required" });
        }

        const payByBalance = input.paymentMethod === "balance";

        // ---- Promo code validation + discount ----
        let discountKs = 0;
        let appliedPromoId: number | null = null;
        if (input.promoCode) {
          const code = input.promoCode.trim().toUpperCase();
          const promo = await db.getPromoByCode(code);
          if (!promo || !promo.isActive) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Promo code မမှန်ပါ" });
          }
          if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Promo code သက်တမ်းကုန်သွားပါပြီ" });
          }
          if (promo.maxUses != null && promo.usedCount >= promo.maxUses) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Promo code အသုံးပြုခွင့် ပြည့်သွားပါပြီ" });
          }
          if (promo.minOrderKs != null && pkg.priceKs < promo.minOrderKs) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Order amount နည်းနေပါသည်" });
          }
          const used = await db.countUserRedemptions(promo.id, ctx.user.id);
          if (used >= promo.perUserLimit) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "ဤ promo code ကို သုံးပြီးသား ဖြစ်ပါသည်" });
          }
          discountKs = promo.discountType === "percent"
            ? Math.floor((pkg.priceKs * promo.discountValue) / 100)
            : promo.discountValue;
          if (discountKs > pkg.priceKs) discountKs = pkg.priceKs;
          appliedPromoId = promo.id;
        }
        const finalKs = pkg.priceKs - discountKs;


        // For balance payments, debit the prepaid wallet up-front and mark the
        // order processing immediately (no receipt / manual approval needed).
        if (payByBalance) {
          const bal = await db.getUserBalance(ctx.user.id);
          if (bal < finalKs) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Insufficient balance" });
          }
        }

        let receiptKey: string | undefined;
        let receiptUrl: string | undefined;
        if (input.receiptDataUrl) {
          const uploaded = await uploadDataUrl(input.receiptDataUrl, `receipts/${ctx.user.id}`);
          receiptKey = uploaded.key;
          receiptUrl = uploaded.url;
        }

        const res = await db.createOrder({
          userId: ctx.user.id,
          productId: product.id,
          packageId: pkg.id,
          productName: product.name,
          packageLabel: pkg.label,
          totalPriceKs: finalKs,
          gameUserId: input.gameUserId ?? null,
          gameServerId: input.gameServerId ?? null,
          paymentMethod: input.paymentMethod ?? null,
          receiptKey: receiptKey ?? null,
          receiptUrl: receiptUrl ?? null,
          status: payByBalance ? "processing" : "pending",
        });

        if (payByBalance) {
          // Deduct from balance and write a ledger entry tied to this order.
          await db.adjustBalance(
            ctx.user.id,
            -finalKs,
            "topup",
            `Top-up: ${product.name} ${pkg.label}`,
            res.id,
          );

          // Auto-deliver Telegram Premium/Stars via iStar API
          if (input.gameUserId && product.name.toLowerCase().includes("telegram")) {
            try {
              const label = pkg.label.toLowerCase();
              if (label.includes("stars")) {
                const match = label.match(/[0-9]+/);
                const qty = match ? parseInt(match[0]) : 100;
                const result = await istarBuyStars(input.gameUserId, qty);
                if (result?.order_id || result?.status === "pending") {
                  await db.setOrderStatus(res.id, "completed", `Auto-delivered ${qty} Stars via iStar`);
                  notifyOwner({ title: "✅ Stars Auto-Delivered!", content: `⭐ ${qty} Stars → ${input.gameUserId}` }).catch(() => {});
                }
              } else {
                const months = label.includes("12") ? 12 : label.includes("6") ? 6 : 3;
                const result = await istarBuyPremium(input.gameUserId, months as 3|6|12);
                if (result?.order_id || result?.status === "pending") {
                  await db.setOrderStatus(res.id, "completed", `Auto-delivered Premium ${months}m via iStar`);
                  notifyOwner({ title: "✅ Premium Auto-Delivered!", content: `💎 Premium ${months}m → ${input.gameUserId}` }).catch(() => {});
                }
              }
            } catch (e: any) {
              console.error("iStar auto-deliver failed:", e);
              notifyOwner({ title: "⚠️ Auto-Deliver Failed!", content: `Order #${res.id} — ${product.name} ${pkg.label}\n👤 ${input.gameUserId}\n❌ ${e?.message ?? "iStar error"}\n💡 iStar balance စစ်ပါ` }).catch(() => {});
            }
          }

          // Auto-deliver stocked items
          const credentials = await db.deliverStockItem(product.id, res.id);
          if (credentials) {
            await db.setOrderStatus(res.id, "completed", "Auto-delivered from stock");
          }
        }

        notifyOwner({
          title: "🛒 Order အသစ်!",
          content: `📦 ${product.name} — ${pkg.label}\n💰 ${pkg.priceKs.toLocaleString()} Ks\n👤 ${ctx.user.name ?? "user #" + ctx.user.id}${ctx.user.email ? " (" + ctx.user.email + ")" : ""}${input.gameUserId ? "\n🎮 ID: " + input.gameUserId + (input.gameServerId ? " (" + input.gameServerId + ")" : "") : ""}${payByBalance ? "\n💳 Paid by balance" : ""}\n🕐 ${new Date().toLocaleString("en-GB", { timeZone: "Asia/Yangon" })}`,
        }).catch(() => {});

        if (appliedPromoId != null) {
          await db.recordRedemption({ promoId: appliedPromoId, userId: ctx.user.id, orderId: res.id, discountKs });
          await db.incrementPromoUse(appliedPromoId);
        }

        return { id: res.id };
      }),
  }),

  promo: router({
    validate: protectedProcedure
      .input(z.object({ code: z.string().trim().max(40), packageId: z.number().int() }))
      .query(async ({ ctx, input }) => {
        const pkg = await db.getPackageById(input.packageId);
        if (!pkg) return { valid: false, message: "Package not found", discountKs: 0, finalKs: 0 };
        const code = input.code.trim().toUpperCase();
        const promo = await db.getPromoByCode(code);
        if (!promo || !promo.isActive) return { valid: false, message: "Promo code မမှန်ပါ", discountKs: 0, finalKs: pkg.priceKs };
        if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) return { valid: false, message: "သက်တမ်းကုန်သွားပါပြီ", discountKs: 0, finalKs: pkg.priceKs };
        if (promo.maxUses != null && promo.usedCount >= promo.maxUses) return { valid: false, message: "အသုံးပြုခွင့် ပြည့်သွားပါပြီ", discountKs: 0, finalKs: pkg.priceKs };
        if (promo.minOrderKs != null && pkg.priceKs < promo.minOrderKs) return { valid: false, message: "Order amount နည်းနေပါသည်", discountKs: 0, finalKs: pkg.priceKs };
        const used = await db.countUserRedemptions(promo.id, ctx.user.id);
        if (used >= promo.perUserLimit) return { valid: false, message: "သုံးပြီးသား ဖြစ်ပါသည်", discountKs: 0, finalKs: pkg.priceKs };
        let discountKs = promo.discountType === "percent" ? Math.floor((pkg.priceKs * promo.discountValue) / 100) : promo.discountValue;
        if (discountKs > pkg.priceKs) discountKs = pkg.priceKs;
        return { valid: true, message: "OK", discountKs, finalKs: pkg.priceKs - discountKs, discountType: promo.discountType, discountValue: promo.discountValue };
      }),
    adminList: adminProcedure.query(() => db.listPromos()),
    adminCreate: adminProcedure
      .input(z.object({
        code: z.string().trim().min(1).max(40),
        discountType: z.enum(["percent", "fixed"]),
        discountValue: z.number().int().min(1),
        minOrderKs: z.number().int().min(0).nullish(),
        maxUses: z.number().int().min(1).nullish(),
        perUserLimit: z.number().int().min(1).default(1),
        isActive: z.boolean().default(true),
        expiresAt: z.string().nullish(),
      }))
      .mutation(async ({ input }) => {
        const code = input.code.trim().toUpperCase();
        return db.createPromo({
          code,
          discountType: input.discountType,
          discountValue: input.discountValue,
          minOrderKs: input.minOrderKs ?? null,
          maxUses: input.maxUses ?? null,
          perUserLimit: input.perUserLimit,
          isActive: input.isActive,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        });
      }),
    adminUpdate: adminProcedure
      .input(z.object({
        id: z.number().int(),
        discountType: z.enum(["percent", "fixed"]).optional(),
        discountValue: z.number().int().min(1).optional(),
        minOrderKs: z.number().int().min(0).nullish(),
        maxUses: z.number().int().min(1).nullish(),
        perUserLimit: z.number().int().min(1).optional(),
        isActive: z.boolean().optional(),
        expiresAt: z.string().nullish(),
      }))
      .mutation(async ({ input }) => {
        const { id, expiresAt, ...rest } = input;
        const data: Record<string, unknown> = { ...rest };
        if (expiresAt !== undefined) data.expiresAt = expiresAt ? new Date(expiresAt) : null;
        await db.updatePromo(id, data as any);
        return { success: true };
      }),
    adminDelete: adminProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ input }) => {
        await db.deletePromo(input.id);
        return { success: true };
      }),
  }),

  referral: router({
    create: protectedProcedure
      .input(z.object({ referrerId: z.number().int(), deviceHash: z.string().max(64).optional() }))
      .mutation(async ({ ctx, input }) => {
        if (input.referrerId === ctx.user.id) return { success: false, reason: "self" };
        const existing = await db.getReferralByReferredId(ctx.user.id);
        if (existing) return { success: false, reason: "already_referred" };
        if (input.deviceHash) {
          const deviceUsed = await db.getReferralByDeviceHash(input.deviceHash);
          if (deviceUsed) return { success: false, reason: "device_used" };
        }
        const referrer = await db.getUserById(input.referrerId);
        if (!referrer) return { success: false, reason: "referrer_not_found" };
        const count = await db.countReferralsByReferrer(input.referrerId);
        if (count >= 20) return { success: false, reason: "limit_reached" };
        await db.createReferral({ referrerId: input.referrerId, referredId: ctx.user.id, deviceHash: input.deviceHash ?? null, status: "pending" });
        const welcomePromo = await db.getPromoByCode("WELCOME10");
        if (welcomePromo) await db.collectCoupon(ctx.user.id, welcomePromo.id, "welcome").catch(() => {});
        return { success: true };
      }),
    myStats: protectedProcedure.query(async ({ ctx }) => {
      const refs = await db.listMyReferrals(ctx.user.id);
      return {
        referralCode: String(ctx.user.id),
        total: refs.length,
        pending: refs.filter(r => r.status === "pending").length,
        completed: refs.filter(r => r.status === "completed").length,
        earned: refs.filter(r => r.status === "completed").length * 500,
      };
    }),
    myCoupons: protectedProcedure.query(({ ctx }) => db.getUserCoupons(ctx.user.id)),
    listPublic: publicProcedure.query(() => db.listPublicPromos()),
    collect: protectedProcedure
      .input(z.object({ promoId: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        const promo = await db.getPromoById(input.promoId);
        if (!promo || !promo.isActive) throw new TRPCError({ code: "BAD_REQUEST", message: "Promo မတွေ့" });
        await db.collectCoupon(ctx.user.id, input.promoId, "collect");
        return { success: true };
      }),
  }),

  support: router({
    myMessages: protectedProcedure.query(({ ctx }) => db.getSupportMessages(ctx.user.id)),
    send: protectedProcedure
      .input(z.object({ content: z.string().min(1).max(2000), mode: z.enum(["ai", "admin"]) }))
      .mutation(async ({ ctx, input }) => {
        await db.addSupportMessage(ctx.user.id, "user", input.content);
        if (input.mode === "ai" && process.env.ANTHROPIC_API_KEY) {
          const history = await db.getSupportMessages(ctx.user.id);
          const msgs = history.map(m => ({ role: (m.role === "user" ? "user" : "assistant") as "user"|"assistant", content: m.content }));
          try {
            const res = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
              body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1024,
                system: `You are a support agent for gamingitem-mm.shop, a Myanmar game top-up shop. Reply in Burmese (Myanmar language). Be helpful, friendly and concise.

You can help with:
- Game top-up orders, deposits, payments
- Rank Boost Service (MLBB, HOK, Genshin, WW) — order tracking by #RB number
- Game Account listings
- Stock items and digital product delivery

When user mentions an order number like #RB1001 or #1001:
- Tell them their order is being reviewed by admin
- Status flow: New → Review → Quotation → Payment → Booster Assigned → In Progress → Completed → Delivered
- Advise them to wait for admin response or contact via this chat

Service pricing:
MLBB: Warrior→Mythical Immortal cumulative pricing starting from 7,000 Ks per tier
HOK: Bronze→King cumulative pricing starting from 7,000 Ks per tier  
Genshin: Daily Package 22,000 Ks / Exploration per region 8,500-17,000 Ks
WW: Region Exploration 7,000 Ks / Events 4,000-8,000 Ks`,
                messages: msgs }),
            });
            const data = await res.json();
            const reply = data.content?.[0]?.text ?? "ခဏစောင့်ပေးပါ၊ ကူညီပေးပါမည်။";
            await db.addSupportMessage(ctx.user.id, "assistant", reply);
            return { success: true, aiReply: reply };
          } catch { return { success: true, aiReply: null }; }
        }
        return { success: true, aiReply: null };
      }),
    adminList: adminProcedure.query(() => db.getAllSupportConversations()),
    adminGetMessages: adminProcedure
      .input(z.object({ userId: z.number().int() }))
      .query(({ input }) => db.getSupportMessages(input.userId)),
    adminReply: adminProcedure
      .input(z.object({ userId: z.number().int(), content: z.string().min(1).max(2000) }))
      .mutation(async ({ input }) => {
        await db.addSupportMessage(input.userId, "admin", input.content);
        return { success: true };
      }),
    adminClear: adminProcedure
      .input(z.object({ userId: z.number().int() }))
      .mutation(async ({ input }) => { await db.deleteSupportMessages(input.userId); return { success: true }; }),
    notifications: protectedProcedure.query(({ ctx }) => db.getUnreadSupportInfo(ctx.user.id)),
    markRead: protectedProcedure.mutation(async ({ ctx }) => { await db.markSupportRead(ctx.user.id); return { success: true }; }),
  }),

  review: router({
    // Submit review (completed order ရှိမှ)
    submit: protectedProcedure
      .input(z.object({
        orderId: z.number().int(),
        productId: z.number().int(),
        rating: z.number().int().min(1).max(5),
        comment: z.string().max(500).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const order = await db.getOrderById(input.orderId);
        if (!order || order.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        if (order.status !== "completed") throw new TRPCError({ code: "BAD_REQUEST", message: "Order မပြီးသေး" });
        const existing = await db.getReviewByOrder(input.orderId);
        if (existing) throw new TRPCError({ code: "BAD_REQUEST", message: "Review တင်ပြီးသား" });
        await db.createReview({ userId: ctx.user.id, productId: input.productId, orderId: input.orderId, rating: input.rating, comment: input.comment ?? null });
        await db.addSpinTicket(ctx.user.id, 1);
        return { success: true, ticketEarned: true };
      }),
    // Get reviews for a product
    forProduct: publicProcedure
      .input(z.object({ productId: z.number().int() }))
      .query(({ input }) => db.listReviewsByProduct(input.productId)),
    // Check if user already reviewed an order
    myReview: protectedProcedure
      .input(z.object({ orderId: z.number().int() }))
      .query(({ input }) => db.getReviewByOrder(input.orderId)),
    // Get my spin tickets
    myTickets: protectedProcedure.query(async ({ ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      return { tickets: user?.spinTickets ?? 0 };
    }),
  }),

  stock: router({
    listByProduct: adminProcedure
      .input(z.object({ productId: z.number().int() }))
      .query(({ input }) => db.listStockByProduct(input.productId)),
    countAvailable: publicProcedure
      .input(z.object({ productId: z.number().int() }))
      .query(({ input }) => db.countAvailableStock(input.productId)),
    add: adminProcedure
      .input(z.object({ productId: z.number().int(), planName: z.string().min(1).max(120), credentials: z.string().min(1) }))
      .mutation(async ({ input }) => {
        await db.addStockItem({ productId: input.productId, planName: input.planName, credentials: input.credentials, isUsed: false });
        return { success: true };
      }),
    addBulk: adminProcedure
      .input(z.object({ productId: z.number().int(), planName: z.string().min(1).max(120), credentialsList: z.array(z.string().min(1)) }))
      .mutation(async ({ input }) => {
        for (const cred of input.credentialsList) {
          await db.addStockItem({ productId: input.productId, planName: input.planName, credentials: cred, isUsed: false });
        }
        return { success: true, added: input.credentialsList.length };
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ input }) => { await db.deleteStockItem(input.id); return { success: true }; }),
  }),

  rankBoost: router({
    create: protectedProcedure
      .input(z.object({
        gameType: z.string().min(1).max(60),
        serviceType: z.enum(["rank_boost","progression"]).default("rank_boost"),
        boostType: z.enum(["pilot","duo","solo"]).default("pilot"),
        uid: z.string().max(120).optional(),
        serverId: z.string().max(60).optional(),
        currentRank: z.string().max(80).optional(),
        targetRank: z.string().max(80).optional(),
        currentStars: z.string().max(60).optional(),
        services: z.string().max(2000).optional(),
        adventureRank: z.string().max(60).optional(),
        contact: z.string().max(200).optional(),
        accountNote: z.string().max(1000).optional(),
        screenshotUrl: z.string().max(500).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const res = await db.createRankBoostOrder({
          ...input, userId: ctx.user.id,
          uid: input.uid ?? null, serverId: input.serverId ?? null,
          currentRank: input.currentRank ?? null, targetRank: input.targetRank ?? null,
          currentStars: input.currentStars ?? null, services: input.services ?? null,
          adventureRank: input.adventureRank ?? null, contact: input.contact ?? null,
          accountNote: input.accountNote ?? null, screenshotUrl: input.screenshotUrl ?? null,
        });
        const svcLabel = input.serviceType === "progression" ? "Progression" : `${input.currentRank} → ${input.targetRank}`;
        notifyOwner({ title: "🏆 New Boost Order!", content: `${ctx.user.name} — ${input.gameType} | ${svcLabel} | ${input.boostType}` }).catch(() => {});
        return { success: true, id: res.id };
      }),
    myOrders: protectedProcedure.query(({ ctx }) => db.listRankBoostOrders(ctx.user.id)),
    adminList: adminProcedure.query(() => db.listRankBoostOrders()),
    adminUpdate: adminProcedure
      .input(z.object({
        id: z.number().int(),
        status: z.enum(["new","review","quotation","payment_received","booster_assigned","in_progress","completed","delivered","closed","rejected"]).optional(),
        adminNote: z.string().optional(),
        quotedPriceKs: z.number().int().optional(),
        depositPriceKs: z.number().int().optional(),
        boosterName: z.string().optional(),
        progressNote: z.string().optional(),
        accountEmail: z.string().optional(),
        accountPassword: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateRankBoostOrder(id, data as any);
        return { success: true };
      }),
  }),

  gameAcc: router({
    listPublic: publicProcedure.query(() => db.listGameAccountListings("listed")),
    myListings: protectedProcedure.query(({ ctx }) => db.listGameAccountListings().then(r => r.filter(l => l.userId === ctx.user.id))),
    submit: protectedProcedure
      .input(z.object({
        gameType: z.string().min(1).max(60),
        uid: z.string().max(120).optional(),
        ign: z.string().max(120).optional(),
        rank: z.string().max(80).optional(),
        loginMethod: z.string().max(200).optional(),
        accountDetails: z.string().max(2000).optional(),
        screenshotUrl: z.string().optional(),
        skinImageUrls: z.string().optional(),
        sellerPriceKs: z.number().int().min(1000),
      }))
      .mutation(async ({ ctx, input }) => {
        const buyPrice = Math.floor(input.sellerPriceKs * 0.8);
        const sellPrice = Math.floor(buyPrice * 1.2);
        const res = await db.createGameAccountListing({ ...input, userId: ctx.user.id, adminBuyPriceKs: buyPrice, adminSellPriceKs: sellPrice, uid: input.uid ?? null, ign: input.ign ?? null, rank: input.rank ?? null, loginMethod: input.loginMethod ?? null, accountDetails: input.accountDetails ?? null, screenshotUrl: input.screenshotUrl ?? null, skinImageUrls: input.skinImageUrls ?? null });
        notifyOwner({ title: "💼 New Account Listing!", content: `${ctx.user.name} — ${input.gameType} | Rank: ${input.rank ?? "?"} | Asking: ${input.sellerPriceKs.toLocaleString()} Ks | Admin buys: ${buyPrice.toLocaleString()} Ks` }).catch(() => {});
        return { success: true, id: res.id };
      }),
    adminList: adminProcedure.query(() => db.listGameAccountListings()),
    adminUpdate: adminProcedure
      .input(z.object({
        id: z.number().int(),
        status: z.enum(["pending","approved","listed","sold","rejected"]).optional(),
        adminNote: z.string().optional(),
        adminCredentials: z.string().optional(),
        adminBuyPriceKs: z.number().int().optional(),
        adminSellPriceKs: z.number().int().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateGameAccountListing(id, data as any);
        return { success: true };
      }),
    buy: protectedProcedure
      .input(z.object({
        listingId: z.number().int(),
        paymentMethod: z.string(),
        contact: z.string().optional(),
        receiptUrl: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const listing = await db.getGameAccountListing(input.listingId);
        if (!listing) throw new TRPCError({ code: "NOT_FOUND", message: "Listing မတွေ့" });
        if (listing.status !== "listed") throw new TRPCError({ code: "BAD_REQUEST", message: "Account ရရှိနိုင်မည်မဟုတ်" });
        const order = await db.createOrder({
          userId: ctx.user.id,
          productId: 1,
          packageId: 0,
          productName: `Game Acc: ${listing.gameType} — ${listing.ign ?? ""}`,
          packageLabel: `${listing.gameType} Account`,
          totalPriceKs: listing.adminSellPriceKs,
          gameUserId: input.contact ?? null,
          paymentMethod: input.paymentMethod,
          receiptKey: null,
          receiptUrl: input.receiptUrl ?? null,
          status: input.paymentMethod === "balance" ? "processing" : "pending",
        });
        if (input.paymentMethod === "balance") {
          const bal = await db.getUserBalance(ctx.user.id);
          if (bal < listing.adminSellPriceKs) throw new TRPCError({ code: "BAD_REQUEST", message: "Balance မလုံ" });
          await db.adjustBalance(ctx.user.id, -listing.adminSellPriceKs, "topup", `Game Acc: ${listing.ign}`, order.id);
          if (listing.adminCredentials) {
            await db.setOrderStatus(order.id, "completed", listing.adminCredentials);
            await db.updateGameAccountListing(input.listingId, { status: "sold" } as any);
          }
        }
        notifyOwner({ title: "💼 Acc ဝယ်မည်!", content: `${ctx.user.name} → ${listing.gameType} ${listing.ign} | ${listing.adminSellPriceKs.toLocaleString()} Ks | ${input.paymentMethod}` }).catch(()=>{});
        return { success: true, orderId: order.id, autoDelivered: input.paymentMethod === "balance" && !!listing.adminCredentials };
      }),
    listPublic: publicProcedure.query(async () => {
      const all = await db.listGameAccountListings();
      return (all as any[]).filter((l: any) => l.status === "listed");
    }),
  }),

  googleReview: router({
    submit: protectedProcedure
      .input(z.object({ screenshotUrl: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const existing = await db.getGoogleReviewByUser(ctx.user.id);
        if (existing && existing.status === "approved") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "ရပြီးသား — Ticket ရပြီ!" });
        }
        await db.createGoogleReviewSubmission(ctx.user.id, input.screenshotUrl);
        notifyOwner({ title: "🌟 Google Review Submission!", content: `User: ${ctx.user.name ?? ctx.user.id}\nScreenshot: ${input.screenshotUrl}` }).catch(() => {});
        return { success: true };
      }),
    myStatus: protectedProcedure.query(({ ctx }) => db.getGoogleReviewByUser(ctx.user.id)),
    adminList: adminProcedure.query(() => db.listGoogleReviewSubmissions()),
    adminApprove: adminProcedure
      .input(z.object({ id: z.number().int(), userId: z.number().int(), status: z.enum(["approved","rejected"]), adminNote: z.string().optional() }))
      .mutation(async ({ input }) => {
        await db.updateGoogleReviewStatus(input.id, input.status, input.adminNote);
        if (input.status === "approved") {
          await db.addSpinTicket(input.userId, 1);
        }
        return { success: true };
      }),
    getReviewUrl: publicProcedure.query(async () => {
      const settings = await db.getSiteSettings();
      return { url: (settings as any).googleReviewUrl ?? "" };
    }),
  }),

  /* ----------------------------- Balance / Wallet ----------------------------- */

  balance: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const balanceKs = await db.getUserBalance(ctx.user.id);
      return { balanceKs };
    }),
    history: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(100).default(50) }).optional())
      .query(({ ctx, input }) => db.listBalanceTransactions(ctx.user.id, input?.limit ?? 50)),
  }),

  /* ----------------------------- Deposits ----------------------------- */
  deposit: router({
    myDeposits: protectedProcedure.query(({ ctx }) => db.listDepositsByUser(ctx.user.id)),

    // Create a new deposit request. For TON, computes the exact TON amount to send
    // and returns a deep link + memo. For others, returns the destination account.
    create: protectedProcedure
      .input(
        z.object({
          amountKs: z.number().int().min(1000).max(100_000_000),
          method: depositMethodEnum,
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const settings = await db.getSiteSettings();
        const accounts = await db.listPaymentAccounts(true);
        const memo = generateMemo();
        const autoVerify = AUTO_VERIFY_METHODS.has(input.method);

        let expectedTon: string | null = null;
        let tonDeepLink: string | null = null;
        let destination = "";

        if (input.method === "ton") {
          const tonAcc = accounts.find(a => a.method.toLowerCase() === "ton");
          destination = tonAcc?.accountNumber ?? "";
          const tonAmount = await ksToTon(input.amountKs, settings.usdToKs);
          expectedTon = tonAmount.toFixed(4);
          // TON deep link with amount (nanoton) and text comment (memo).
          const nano = Math.round(tonAmount * 1e9);
          tonDeepLink = `ton://transfer/${destination}?amount=${nano}&text=${encodeURIComponent(memo)}`;
        } else if (input.method === "binance") {
          const acc = accounts.find(a => a.method.toLowerCase() === "binance");
          destination = acc?.accountNumber ?? "";
        } else {
          const map: Record<string, string> = {
            kbzpay: "kbz",
            wavepay: "wave",
            ayapay: "aya",
            uabpay: "uab",
          };
          const needle = map[input.method] ?? input.method;
          const acc = accounts.find(a => a.method.toLowerCase().includes(needle));
          destination = acc?.accountNumber ?? "";
        }

        const res = await db.createDeposit({
          userId: ctx.user.id,
          amountKs: input.amountKs,
          method: input.method,
          memo,
          expectedTon,
          autoVerify,
          status: "pending",
        });

        return {
          id: res.id,
          memo,
          amountKs: input.amountKs,
          method: input.method,
          destination,
          expectedTon,
          tonDeepLink,
          autoVerify,
        };
      }),

    // Submit a receipt for a manual (mobile wallet / binance) deposit.
    submitReceipt: protectedProcedure
      .input(z.object({ depositId: z.number().int(), receiptDataUrl: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const dep = await db.getDepositById(input.depositId);
        if (!dep || dep.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Deposit not found" });
        }
        if (dep.status !== "pending") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Deposit already processed" });
        }
        const uploaded = await uploadDataUrl(input.receiptDataUrl, `deposits/${ctx.user.id}`);
        await db.updateDeposit(dep.id, { receiptKey: uploaded.key, receiptUrl: uploaded.url });
        notifyOwner({
          title: "💵 Deposit အသစ်!",
          content: `💰 ${dep.amountKs.toLocaleString()} Ks\n🏦 ${dep.method.toUpperCase()}\n👤 ${ctx.user.name ?? "user #" + ctx.user.id}${ctx.user.email ? " (" + ctx.user.email + ")" : ""}\n🆔 Memo: ${dep.memo}\n🕐 ${new Date().toLocaleString("en-GB", { timeZone: "Asia/Yangon" })}`,
        }).catch(() => {});
        return { success: true };
      }),

    // Trigger auto-verification for a TON deposit (polls TonAPI by memo + amount).
    verify: protectedProcedure
      .input(z.object({ depositId: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        const dep = await db.getDepositById(input.depositId);
        if (!dep || dep.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Deposit not found" });
        }
        if (dep.status === "completed") {
          const balanceKs = await db.getUserBalance(ctx.user.id);
          return { verified: true, balanceKs };
        }
        if (dep.method !== "ton") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This deposit method is verified manually by admin",
          });
        }
        const minTon = dep.expectedTon ? Number(dep.expectedTon) * 0.99 : 0; // 1% tolerance
        const result = await verifyTonPaymentByMemo(dep.memo, minTon);
        if (!result.found) {
          return { verified: false };
        }
        await db.completeDeposit(dep.id, result.hash, "Auto-verified via TonAPI");
        const balanceKs = await db.getUserBalance(ctx.user.id);
        // Auto-deliver pending Telegram orders if balance is now enough
        try {
          const pendingOrders = await db.getUserOrders(ctx.user.id);
          for (const order of pendingOrders) {
            if (order.status !== "pending") continue;
            const label = (order.packageLabel ?? "").toLowerCase();
            const isTelegram = label.includes("star") || label.includes("premium");
            if (!isTelegram) continue;
            if (balanceKs < (order.totalPriceKs ?? 0)) continue;
            // Deduct balance
            await db.adjustBalance(ctx.user.id, -(order.totalPriceKs ?? 0), "topup", `Auto-deliver: ${order.packageLabel}`, order.id);
            // Deliver
            const username = order.gameUserId ?? "";
            let deliverResult: any = null;
            if (label.includes("premium")) {
              const months = label.includes("12") ? 12 : label.includes("6") ? 6 : 3;
              deliverResult = await istarBuyPremium(username, months as 3|6|12);
            } else if (label.includes("star")) {
              const qty = parseInt(label.replace(/[^0-9]/g, "")) || 50;
              deliverResult = await istarBuyStars(username, qty);
            }
            if (deliverResult?.order_id) {
              await db.setOrderStatus(order.id, "completed", `iStar order: ${deliverResult.order_id}`);
              notifyOwner({ title: "✅ Auto-delivered!", content: `${order.packageLabel} → ${username} | iStar: ${deliverResult.order_id}` }).catch(() => {});
            }
          }
        } catch (e: any) {
          console.error("Auto-deliver error:", e?.message);
        }
        return { verified: true, balanceKs };
      }),
  }),

  /* ----------------------------- Leaderboard (public) ----------------------------- */
  leaderboard: router({
    top: publicProcedure
      .input(z.object({ limit: z.number().int().min(1).max(50).default(10) }).optional())
      .query(({ input }) => db.getLeaderboard(input?.limit ?? 10)),
  }),

  /* ----------------------------- Spin Wheel ----------------------------- */
  spin: router({
    status: protectedProcedure.query(async ({ ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      const last = user?.lastSpinAt ? new Date(user.lastSpinAt).getTime() : 0;
      const now = Date.now();
      const nextAvailableAt = last ? last + SPIN_COOLDOWN_MS : 0;
      const canSpin = now >= nextAvailableAt;
      const history = await db.listSpinsByUser(ctx.user.id, 10);
      const prizes = await db.listSpinPrizes(true);
      return {
        canSpin,
        nextAvailableAt,
        prizes: prizes.map(p => ({
          id: p.id,
          label: p.label,
          labelMy: p.labelMy,
          valueKs: p.valueKs,
          color: p.color,
        })),
        history,
      };
    }),

    spin: protectedProcedure.mutation(async ({ ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      // Ticket-based spin (review တင်မှ ticket ရ)
      const tickets = user?.spinTickets ?? 0;
      if (tickets < 1) throw new TRPCError({ code: "BAD_REQUEST", message: "Spin ticket မရှိသေး — review တင်ပြီး ticket ရပါ" });
      await db.useSpinTicket(ctx.user.id);
      const last = user?.lastSpinAt ? new Date(user.lastSpinAt).getTime() : 0;
      const now = Date.now();
      if (false && last && now < last + SPIN_COOLDOWN_MS) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "You have already spun today. Come back tomorrow!",
        });
      }
      const prizes = (await db.listSpinPrizes(true)) as PrizeRow[];
      if (prizes.length === 0) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No prizes configured" });
      }
      const { index, prize } = pickPrize(prizes);
      await db.recordSpin(ctx.user.id, prize.label, prize.valueKs);
      return { index, label: prize.label, valueKs: prize.valueKs };
    }),
  }),

  /* ----------------------------- Site settings (public read) ----------------------------- */
  upload: router({
    image: protectedProcedure
      .input(z.object({ dataUrl: z.string(), folder: z.string().default("uploads") }))
      .mutation(async ({ input }) => {
        const uploaded = await uploadDataUrl(input.dataUrl, input.folder);
        return { url: uploaded.url };
      }),
  }),
  uid: router({
    checkUid: publicProcedure
      .input(z.object({
        gameType: z.string(),
        uid: z.string().min(1),
        serverId: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { gameType, uid, serverId } = input;
        const g = gameType.toLowerCase();
        try {
          if (g.includes("legend") || g === "mlbb") {
            if (!serverId) return { success: false, name: null, message: "Server ID လိုအပ်သည်" };
            const res = await fetch("https://api.isan.eu.org/nickname/ml", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: uid, server: serverId }),
            });
            const data = await res.json() as any;
            if (data.success) return { success: true, name: data.name as string, message: null };
            return { success: false, name: null, message: "UID / Server ID မမှန်ကန်" };
          }
          if (g.includes("pubg") || g === "pubg") {
            const res = await fetch("https://api.isan.eu.org/nickname/pubgm", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: uid }),
            });
            const data = await res.json() as any;
            if (data.success) return { success: true, name: data.name as string, message: null };
            return { success: false, name: null, message: "UID မမှန်ကန်" };
          }
          if (g.includes("free fire") || g === "freefire") {
            const res = await fetch("https://api.isan.eu.org/nickname/ff", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: uid }),
            });
            const data = await res.json() as any;
            if (data.success) return { success: true, name: data.name as string, message: null };
            return { success: false, name: null, message: "UID မမှန်ကန်" };
          }
          return { success: false, name: null, message: "Game ဒီ feature မပံ့ပိုး" };
        } catch {
          return { success: false, name: null, message: "Server error" };
        }
      }),
  }),
  site: router({
    settings: publicProcedure.query(() => db.getSiteSettings()),
    banners: publicProcedure.query(() => db.listHeroBanners(true)),
  }),

  /* ----------------------------- Admin ----------------------------- */
  admin: router({
    // Generic image upload (base64 data URL -> S3). Used for logos, banners, product photos.
    uploadImage: adminProcedure
      .input(z.object({ dataUrl: z.string(), folder: z.enum(["logos", "banners", "products"]).default("products") }))
      .mutation(async ({ input }) => {
        const uploaded = await uploadDataUrl(input.dataUrl, input.folder);
        return { url: uploaded.url, key: uploaded.key };
      }),

    // Site branding settings
    getSettings: adminProcedure.query(() => db.getSiteSettings()),
    updateSettings: adminProcedure
      .input(
        z.object({
          brandName: z.string().min(1).max(80).optional(),
          brandAccent: z.string().max(80).optional(),
          logoUrl: z.string().nullable().optional(),
          tagline: z.string().max(200).optional(),
          taglineMy: z.string().max(200).optional(),
          contactEmail: z.string().max(200).optional(),
          usdToKs: z.number().int().min(1).max(100000).optional(),
        }),
      )
      .mutation(async ({ input }) => {
        await db.updateSiteSettings(input);
        return { success: true };
      }),

    // Hero banners
    banners: adminProcedure.query(() => db.listHeroBanners(false)),
    createBanner: adminProcedure
      .input(
        z.object({
          badge: z.string().max(80).optional(),
          title: z.string().min(1).max(200),
          titleMy: z.string().max(200).optional(),
          subtitle: z.string().max(300).optional(),
          subtitleMy: z.string().max(300).optional(),
          imageUrl: z.string().nullable().optional(),
          colorFrom: z.string().max(16).optional(),
          colorTo: z.string().max(16).optional(),
          ctaLink: z.string().max(200).optional(),
          isActive: z.boolean().optional(),
          sortOrder: z.number().int().optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const res = await db.createHeroBanner(input);
        return { id: res.id };
      }),
    updateBanner: adminProcedure
      .input(
        z.object({
          id: z.number().int(),
          data: z.object({
            badge: z.string().max(80).nullable().optional(),
            title: z.string().min(1).max(200).optional(),
            titleMy: z.string().max(200).nullable().optional(),
            subtitle: z.string().max(300).nullable().optional(),
            subtitleMy: z.string().max(300).nullable().optional(),
            imageUrl: z.string().nullable().optional(),
            colorFrom: z.string().max(16).optional(),
            colorTo: z.string().max(16).optional(),
            ctaLink: z.string().max(200).nullable().optional(),
            isActive: z.boolean().optional(),
            sortOrder: z.number().int().optional(),
          }),
        }),
      )
      .mutation(async ({ input }) => {
        await db.updateHeroBanner(input.id, input.data);
        return { success: true };
      }),
    deleteBanner: adminProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ input }) => {
        await db.deleteHeroBanner(input.id);
        return { success: true };
      }),

    // Spin prizes
    spinPrizes: adminProcedure.query(() => db.listSpinPrizes(false)),
    createSpinPrize: adminProcedure
      .input(
        z.object({
          label: z.string().min(1).max(120),
          labelMy: z.string().max(120).optional(),
          valueKs: z.number().int().min(0).optional(),
          color: z.string().max(16).optional(),
          weight: z.number().int().min(0).optional(),
          isActive: z.boolean().optional(),
          sortOrder: z.number().int().optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const res = await db.createSpinPrize(input);
        return { id: res.id };
      }),
    updateSpinPrize: adminProcedure
      .input(
        z.object({
          id: z.number().int(),
          data: z.object({
            label: z.string().min(1).max(120).optional(),
            labelMy: z.string().max(120).nullable().optional(),
            valueKs: z.number().int().min(0).optional(),
            color: z.string().max(16).optional(),
            weight: z.number().int().min(0).optional(),
            isActive: z.boolean().optional(),
            sortOrder: z.number().int().optional(),
          }),
        }),
      )
      .mutation(async ({ input }) => {
        await db.updateSpinPrize(input.id, input.data);
        return { success: true };
      }),
    deleteSpinPrize: adminProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ input }) => {
        await db.deleteSpinPrize(input.id);
        return { success: true };
      }),

    stats: adminProcedure.query(async () => {
      const stats = await db.getOrderStats();
      const products = await db.listAllProducts();
      return { ...stats, productCount: products.length };
    }),

    orders: adminProcedure
      .input(z.object({ status: statusEnum.optional() }).optional())
      .query(({ input }) => db.listAllOrders(input?.status)),

    setOrderStatus: adminProcedure
      .input(z.object({ id: z.number().int(), status: statusEnum, adminNote: z.string().optional() }))
      .mutation(async ({ input }) => {
        const order = await db.getOrderById(input.id);
        await db.setOrderStatus(input.id, input.status, input.adminNote);
        if (input.status === "completed" && order) {
          const result = await db.completeReferralReward(order.userId);
          if (result.completed && result.referrerId) {
            notifyOwner({ title: "🎉 Referral Reward!", content: `User #${order.userId} ပထမဆုံး order ဝယ်ပြီ! +500 Ks → User #${result.referrerId}` }).catch(() => {});
          }
          const credentials = await db.deliverStockItem(order.productId, order.id);
          if (credentials) {
            notifyOwner({ title: "📦 Auto Delivered!", content: `Order #${order.id} → credentials auto sent` }).catch(() => {});
          }
        }
        return { success: true };
      }),

    products: adminProcedure.query(() => db.listAllProducts()),

    productWithPackages: adminProcedure
      .input(z.object({ id: z.number().int() }))
      .query(async ({ input }) => {
        const product = await db.getProductById(input.id);
        if (!product) throw new TRPCError({ code: "NOT_FOUND" });
        const pkgs = await db.listPackagesByProduct(product.id, false);
        return { product, packages: pkgs };
      }),

    createProduct: adminProcedure
      .input(
        z.object({
          name: z.string().min(1).max(120),
          slug: z.string().min(1).max(140),
          category: categoryEnum,
          description: z.string().optional(),
          color: z.string().max(16).optional(),
          imageUrl: z.string().optional(),
          needsUserId: z.boolean().optional(),
          needsServerId: z.boolean().optional(),
          topupCount: z.number().int().optional(),
          isActive: z.boolean().optional(),
          sortOrder: z.number().int().optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const res = await db.createProduct(input);
        return { id: res.id };
      }),

    updateProduct: adminProcedure
      .input(
        z.object({
          id: z.number().int(),
          data: z.object({
            name: z.string().min(1).max(120).optional(),
            slug: z.string().min(1).max(140).optional(),
            category: categoryEnum.optional(),
            description: z.string().optional(),
            color: z.string().max(16).optional(),
            imageUrl: z.string().optional(),
            needsUserId: z.boolean().optional(),
            needsServerId: z.boolean().optional(),
            topupCount: z.number().int().optional(),
            isActive: z.boolean().optional(),
            sortOrder: z.number().int().optional(),
          }),
        }),
      )
      .mutation(async ({ input }) => {
        await db.updateProduct(input.id, input.data);
        return { success: true };
      }),

    deleteProduct: adminProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ input }) => {
        await db.deleteProduct(input.id);
        return { success: true };
      }),

    createPackage: adminProcedure
      .input(
        z.object({
          productId: z.number().int(),
          label: z.string().min(1).max(120),
          priceKs: z.number().int().min(0),
          bonusLabel: z.string().max(60).optional(),
          isPopular: z.boolean().optional(),
          isActive: z.boolean().optional(),
          sortOrder: z.number().int().optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const res = await db.createPackage(input);
        return { id: res.id };
      }),

    updatePackage: adminProcedure
      .input(
        z.object({
          id: z.number().int(),
          data: z.object({
            label: z.string().min(1).max(120).optional(),
            priceKs: z.number().int().min(0).optional(),
            bonusLabel: z.string().max(60).optional(),
            isPopular: z.boolean().optional(),
            isActive: z.boolean().optional(),
            sortOrder: z.number().int().optional(),
          }),
        }),
      )
      .mutation(async ({ input }) => {
        await db.updatePackage(input.id, input.data);
        return { success: true };
      }),

    deletePackage: adminProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ input }) => {
        await db.deletePackage(input.id);
        return { success: true };
      }),

    paymentAccounts: adminProcedure.query(() => db.listPaymentAccounts(false)),

    createPaymentAccount: adminProcedure
      .input(
        z.object({
          method: z.string().min(1).max(60),
          accountNumber: z.string().min(1).max(80),
          accountName: z.string().max(120).optional(),
          isActive: z.boolean().optional(),
          sortOrder: z.number().int().optional(),
          qrImageUrl: z.string().optional(),
          instructions: z.string().max(500).optional(),
          instructionsMy: z.string().max(500).optional(),
          autoFlow: z.boolean().optional(),
          walletAddress: z.string().max(200).optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const res = await db.createPaymentAccount(input);
        return { id: res.id };
      }),

    updatePaymentAccount: adminProcedure
      .input(
        z.object({
          id: z.number().int(),
          data: z.object({
            method: z.string().min(1).max(60).optional(),
            accountNumber: z.string().min(1).max(80).optional(),
            accountName: z.string().max(120).optional(),
            isActive: z.boolean().optional(),
            sortOrder: z.number().int().optional(),
            qrImageUrl: z.string().nullish(),
            instructions: z.string().max(500).nullish(),
            instructionsMy: z.string().max(500).nullish(),
            autoFlow: z.boolean().optional(),
            walletAddress: z.string().max(200).nullish(),
          }),
        }),
      )
      .mutation(async ({ input }) => {
        await db.updatePaymentAccount(input.id, input.data);
        return { success: true };
      }),

    // iStar Telegram Premium/Stars delivery
    deliverTelegramPremium: adminProcedure
      .input(z.object({
        orderId: z.number().int(),
        username: z.string().min(1),
        months: z.union([z.literal(3), z.literal(6), z.literal(12)]),
      }))
      .mutation(async ({ input }) => {
        const result = await istarBuyPremium(input.username, input.months);
        if (result?.status === "pending" || result?.order_id) {
          await db.setOrderStatus(input.orderId, "completed", `Telegram Premium ${input.months}m delivered via iStar`);
          return { success: true, orderId: result.order_id };
        }
        throw new Error(result?.message ?? "Delivery failed");
      }),
    deliverTelegramStars: adminProcedure
      .input(z.object({
        orderId: z.number().int(),
        username: z.string().min(1),
        quantity: z.number().int().min(50),
      }))
      .mutation(async ({ input }) => {
        const result = await istarBuyStars(input.username, input.quantity);
        if (result?.status === "pending" || result?.order_id) {
          await db.setOrderStatus(input.orderId, "completed", `Telegram Stars ${input.quantity} delivered via iStar`);
          return { success: true, orderId: result.order_id };
        }
        throw new Error(result?.message ?? "Delivery failed");
      }),
    istarBalance: adminProcedure.query(() => istarGetBalance()),
    deletePaymentAccount: adminProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ input }) => {
        await db.deletePaymentAccount(input.id);
        return { success: true };
      }),

    /* ----------------------------- Admin: Deposits ----------------------------- */
    deposits: adminProcedure
      .input(z.object({ status: z.enum(["pending", "completed", "failed"]).optional() }).optional())
      .query(({ input }) => db.listAllDeposits(input?.status)),

    approveDeposit: adminProcedure
      .input(z.object({ id: z.number().int(), adminNote: z.string().optional() }))
      .mutation(async ({ input }) => {
        const newBalance = await db.completeDeposit(input.id, undefined, input.adminNote);
        return { success: true, newBalance };
      }),

    rejectDeposit: adminProcedure
      .input(z.object({ id: z.number().int(), adminNote: z.string().optional() }))
      .mutation(async ({ input }) => {
        await db.failDeposit(input.id, input.adminNote);
        return { success: true };
      }),

    // Manually credit/adjust a user's balance (admin tool).
    adjustUserBalance: adminProcedure
      .input(
        z.object({
          userId: z.number().int(),
          amountKs: z.number().int(),
          note: z.string().max(200).optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const newBalance = await db.adjustBalance(
          input.userId,
          input.amountKs,
          "adjust",
          input.note ?? "Admin adjustment",
        );
        return { success: true, newBalance };
      }),
  }),
});

export type AppRouter = typeof appRouter;
