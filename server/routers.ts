import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { notifyOwner } from "./_core/notification";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { ksToTon } from "./_core/priceConversion";
import { verifyTonPaymentByMemo } from "./_core/tonPayment";
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

        // For balance payments, debit the prepaid wallet up-front and mark the
        // order processing immediately (no receipt / manual approval needed).
        if (payByBalance) {
          const bal = await db.getUserBalance(ctx.user.id);
          if (bal < pkg.priceKs) {
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
          totalPriceKs: pkg.priceKs,
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
            -pkg.priceKs,
            "topup",
            `Top-up: ${product.name} ${pkg.label}`,
            res.id,
          );
        }

        notifyOwner({
          title: "New top-up order",
          content: `${product.name} — ${pkg.label} (${pkg.priceKs.toLocaleString()} Ks) by ${ctx.user.name ?? "user #" + ctx.user.id}${payByBalance ? " [paid by balance]" : ""}`,
        }).catch(() => {});

        return { id: res.id };
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
          title: "New deposit receipt",
          content: `${dep.method.toUpperCase()} deposit ${dep.amountKs.toLocaleString()} Ks (memo ${dep.memo}) from ${ctx.user.name ?? "user #" + ctx.user.id}`,
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
      const last = user?.lastSpinAt ? new Date(user.lastSpinAt).getTime() : 0;
      const now = Date.now();
      if (last && now < last + SPIN_COOLDOWN_MS) {
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
        await db.setOrderStatus(input.id, input.status, input.adminNote);
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
          }),
        }),
      )
      .mutation(async ({ input }) => {
        await db.updatePaymentAccount(input.id, input.data);
        return { success: true };
      }),

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
