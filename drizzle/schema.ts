import { boolean, decimal, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extended with totalSpentKs for leaderboard and lastSpinAt for spin wheel gating.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  /** Total amount spent on completed orders, in Myanmar Kyat. Drives the leaderboard. */
  totalSpentKs: int("totalSpentKs").default(0).notNull(),
  /** Spin tickets earned from reviews. */
  spinTickets: int("spinTickets").default(0).notNull(),
  /** Last time the user used the daily spin wheel (UTC). Null if never spun. */
  lastSpinAt: timestamp("lastSpinAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Game / app products in the catalog.
 * category must be exactly one of: popular | premium | other
 * (rendered as "Popular Games", "Premium Apps", "Other Games" in UI).
 */
export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  slug: varchar("slug", { length: 140 }).notNull().unique(),
  category: mysqlEnum("category", ["popular", "premium", "other"]).notNull(),
  description: text("description"),
  /** Brand accent color hex for the card fallback logo. */
  color: varchar("color", { length: 16 }).default("#FF74B8").notNull(),
  /** Storage key/url for the product image. Empty = use color fallback. */
  imageUrl: text("imageUrl"),
  /** Whether the top-up form requires a Game User ID. */
  needsUserId: boolean("needsUserId").default(true).notNull(),
  /** Whether the top-up form requires a Server ID (e.g. MLBB). */
  needsServerId: boolean("needsServerId").default(false).notNull(),
  /** Display badge count e.g. "12400+ Top Up". */
  topupCount: int("topupCount").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

/**
 * Purchasable packages belonging to a product (e.g. "86 Diamonds").
 */
export const packages = mysqlTable("packages", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  /** Package label e.g. "86 Diamonds" or "1 Month". */
  label: varchar("label", { length: 120 }).notNull(),
  /** Price in Myanmar Kyat. */
  priceKs: int("priceKs").notNull(),
  /** Optional bonus label e.g. "+5%". */
  bonusLabel: varchar("bonusLabel", { length: 60 }),
  isPopular: boolean("isPopular").default(false).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  priceUsd: decimal("priceUsd", { precision: 10, scale: 4 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Package = typeof packages.$inferSelect;
export type InsertPackage = typeof packages.$inferInsert;

/**
 * Top-up orders placed by users.
 * status must be exactly one of: pending | processing | completed | failed
 * (rendered as Pending, Processing, Completed, Failed).
 */
export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  productId: int("productId").notNull(),
  packageId: int("packageId").notNull(),
  /** Snapshot fields so history stays correct even if product/package later changes. */
  productName: varchar("productName", { length: 120 }).notNull(),
  packageLabel: varchar("packageLabel", { length: 120 }).notNull(),
  totalPriceKs: int("totalPriceKs").notNull(),
  gameUserId: varchar("gameUserId", { length: 120 }),
  gameServerId: varchar("gameServerId", { length: 120 }),
  paymentMethod: varchar("paymentMethod", { length: 60 }),
  /** Storage key for the uploaded receipt image. */
  receiptKey: text("receiptKey"),
  /** Public-ish storage url for the receipt image. */
  receiptUrl: text("receiptUrl"),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  adminNote: text("adminNote"),
  deliveredCredentials: text("deliveredCredentials"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

/**
 * Spin wheel results log (one row per spin).
 */
export const spins = mysqlTable("spins", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  prizeLabel: varchar("prizeLabel", { length: 120 }).notNull(),
  prizeValueKs: int("prizeValueKs").default(0).notNull(),
  spunAt: timestamp("spunAt").defaultNow().notNull(),
});

export type Spin = typeof spins.$inferSelect;
export type InsertSpin = typeof spins.$inferInsert;

/**
 * Payment methods / accounts configurable by admin.
 */
export const paymentAccounts = mysqlTable("paymentAccounts", {
  id: int("id").autoincrement().primaryKey(),
  method: varchar("method", { length: 60 }).notNull(),
  accountNumber: varchar("accountNumber", { length: 80 }).notNull(),
  accountName: varchar("accountName", { length: 120 }),
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  qrImageUrl: text("qrImageUrl"),
  instructions: text("instructions"),
  instructionsMy: text("instructionsMy"),
  autoFlow: boolean("autoFlow").default(false).notNull(),
  walletAddress: varchar("walletAddress", { length: 200 }),
});

export type PaymentAccount = typeof paymentAccounts.$inferSelect;
export type InsertPaymentAccount = typeof paymentAccounts.$inferInsert;

/**
 * Singleton site settings (only one row, id=1) holding admin-customizable branding.
 */
export const siteSettings = mysqlTable("siteSettings", {
  id: int("id").autoincrement().primaryKey(),
  /** Brand name shown next to the logo, e.g. "GameTop-Up". */
  brandName: varchar("brandName", { length: 80 }).default("GameTop-Up").notNull(),
  /** Optional second-color word in the brand (kept for styling) - unused if brandName has its own styling. */
  brandAccent: varchar("brandAccent", { length: 80 }).default("Top-Up").notNull(),
  /** Storage url for the uploaded logo image. Empty = use default gamepad icon. */
  logoUrl: text("logoUrl"),
  /** Main tagline, e.g. "Top Up. Power Up. Win More.". */
  tagline: varchar("tagline", { length: 200 }).default("Top Up. Power Up. Win More.").notNull(),
  /** Myanmar tagline. */
  taglineMy: varchar("taglineMy", { length: 200 }).default("ဖြည့်လိုက်၊ အားဖြည့်လိုက်၊ ပိုနိုင်လိုက်။").notNull(),
  /** Public contact email shown in the footer. */
  contactEmail: varchar("contactEmail", { length: 200 }).default("shineaker@gmail.com").notNull(),
  /** Exchange rate: how many Myanmar Kyat per 1 USD (for TON/Binance deposit conversion). */
  usdToKs: int("usdToKs").default(4500).notNull(),
  adminLastSeenAt: timestamp("adminLastSeenAt"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SiteSettings = typeof siteSettings.$inferSelect;
export type InsertSiteSettings = typeof siteSettings.$inferInsert;

/**
 * Rotating hero banners shown in the auto-moving carousel on the home page.
 */
export const heroBanners = mysqlTable("heroBanners", {
  id: int("id").autoincrement().primaryKey(),
  /** Small badge label, e.g. "Double Joy +20%". */
  badge: varchar("badge", { length: 80 }),
  title: varchar("title", { length: 200 }).notNull(),
  titleMy: varchar("titleMy", { length: 200 }),
  subtitle: varchar("subtitle", { length: 300 }),
  subtitleMy: varchar("subtitleMy", { length: 300 }),
  /** Storage url for an optional background image. */
  imageUrl: text("imageUrl"),
  /** Gradient start/end hex used when no image, e.g. "#7C3AED". */
  colorFrom: varchar("colorFrom", { length: 16 }).default("#7C3AED").notNull(),
  colorTo: varchar("colorTo", { length: 16 }).default("#DB2777").notNull(),
  /** Optional call-to-action link (product slug or route). */
  ctaLink: varchar("ctaLink", { length: 200 }),
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type HeroBanner = typeof heroBanners.$inferSelect;
export type InsertHeroBanner = typeof heroBanners.$inferInsert;

/**
 * Admin-customizable spin wheel prizes. Weight controls probability.
 */
export const spinPrizes = mysqlTable("spinPrizes", {
  id: int("id").autoincrement().primaryKey(),
  label: varchar("label", { length: 120 }).notNull(),
  labelMy: varchar("labelMy", { length: 120 }),
  /** Reward value in Ks (0 for "try again" / non-cash). */
  valueKs: int("valueKs").default(0).notNull(),
  /** Slice color hex. */
  color: varchar("color", { length: 16 }).default("#7C3AED").notNull(),
  /** Relative probability weight (higher = more likely). */
  weight: int("weight").default(10).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
});

export type SpinPrize = typeof spinPrizes.$inferSelect;
export type InsertSpinPrize = typeof spinPrizes.$inferInsert;

/**
 * Per-user prepaid wallet balance (singleton row per user).
 * balanceKs is the spendable balance in Myanmar Kyat.
 */
export const userBalances = mysqlTable("userBalances", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  balanceKs: int("balanceKs").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserBalance = typeof userBalances.$inferSelect;
export type InsertUserBalance = typeof userBalances.$inferInsert;

/**
 * Ledger of all balance movements (deposits, top-up spends, spin rewards, refunds).
 * type: deposit | topup | spin | refund | adjust
 * amountKs is positive for credits, negative for debits.
 */
export const balanceTransactions = mysqlTable("balanceTransactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["deposit", "topup", "spin", "refund", "adjust"]).notNull(),
  amountKs: int("amountKs").notNull(),
  /** Resulting balance after this movement (for easy history display). */
  balanceAfterKs: int("balanceAfterKs").default(0).notNull(),
  description: varchar("description", { length: 200 }),
  /** Optional link to a deposit or order id. */
  refId: int("refId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BalanceTransaction = typeof balanceTransactions.$inferSelect;
export type InsertBalanceTransaction = typeof balanceTransactions.$inferInsert;

/**
 * Balance top-up deposit requests.
 * method: ton | binance | kbzpay | wavepay | ayapay
 * status: pending | completed | failed
 * For TON/Binance these can be auto-verified; mobile wallets are admin-approved.
 */
export const deposits = mysqlTable("deposits", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  amountKs: int("amountKs").notNull(),
  method: varchar("method", { length: 40 }).notNull(),
  /** Unique payment memo/reference shown to user (used for TON comment matching). */
  memo: varchar("memo", { length: 60 }).notNull().unique(),
  /** For TON deposits: the TON amount the user must send. */
  expectedTon: varchar("expectedTon", { length: 40 }),
  /** Verified on-chain / API transaction hash or id. */
  txReference: varchar("txReference", { length: 200 }),
  /** Storage url for uploaded receipt (manual mobile wallet deposits). */
  receiptKey: text("receiptKey"),
  receiptUrl: text("receiptUrl"),
  status: mysqlEnum("status", ["pending", "completed", "failed"]).default("pending").notNull(),
  /** Whether auto-verification (TON/Binance) is applicable. */
  autoVerify: boolean("autoVerify").default(false).notNull(),
  adminNote: text("adminNote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Deposit = typeof deposits.$inferSelect;
export type InsertDeposit = typeof deposits.$inferInsert;

/**
 * Help Center conversation messages, threaded per user.
 * role: user (customer) | assistant (AI auto-reply) | admin (human reply)
 */
export const supportMessages = mysqlTable("supportMessages", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["user", "assistant", "admin"]).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SupportMessage = typeof supportMessages.$inferSelect;
export type InsertSupportMessage = typeof supportMessages.$inferInsert;

/** Promo / discount codes. */
export const promoCodes = mysqlTable("promoCodes", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 40 }).notNull().unique(),
  discountType: mysqlEnum("discountType", ["percent", "fixed"]).default("percent").notNull(),
  discountValue: int("discountValue").notNull(),
  minOrderKs: int("minOrderKs"),
  maxUses: int("maxUses"),
  usedCount: int("usedCount").default(0).notNull(),
  perUserLimit: int("perUserLimit").default(1).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** Per-user promo redemption tracking. */
export const promoRedemptions = mysqlTable("promoRedemptions", {
  id: int("id").autoincrement().primaryKey(),
  promoId: int("promoId").notNull(),
  userId: int("userId").notNull(),
  orderId: int("orderId"),
  discountKs: int("discountKs").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type InsertPromoCode = typeof promoCodes.$inferInsert;
export type InsertPromoRedemption = typeof promoRedemptions.$inferInsert;

/** Referral tracking */
export const referrals = mysqlTable("referrals", {
  id: int("id").autoincrement().primaryKey(),
  referrerId: int("referrerId").notNull(),
  referredId: int("referredId").notNull().unique(),
  deviceHash: varchar("deviceHash", { length: 64 }),
  status: mysqlEnum("status", ["pending", "completed"]).default("pending").notNull(),
  rewardPaidAt: timestamp("rewardPaidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export const userCoupons = mysqlTable("userCoupons", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  promoId: int("promoId").notNull(),
  source: mysqlEnum("source", ["welcome", "collect", "referral"]).default("collect").notNull(),
  collectedAt: timestamp("collectedAt").defaultNow().notNull(),
});
export type InsertReferral = typeof referrals.$inferInsert;
export type InsertUserCoupon = typeof userCoupons.$inferInsert;

/** Support chat messages */

/** Product reviews */
export const reviews = mysqlTable("reviews", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  productId: int("productId").notNull(),
  orderId: int("orderId").notNull().unique(),
  rating: int("rating").default(5).notNull(),
  comment: text("comment"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type InsertReview = typeof reviews.$inferInsert;

/** Pre-stocked digital product credentials */
export const stockItems = mysqlTable("stockItems", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  planName: varchar("planName", { length: 120 }).notNull(),
  credentials: text("credentials").notNull(),
  isUsed: boolean("isUsed").default(false).notNull(),
  orderId: int("orderId"),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type InsertStockItem = typeof stockItems.$inferInsert;

/** Rank Boost Service orders */
export const rankBoostOrders = mysqlTable("rankBoostOrders", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  gameType: varchar("gameType", { length: 60 }).notNull(),
  currentRank: varchar("currentRank", { length: 80 }).notNull(),
  targetRank: varchar("targetRank", { length: 80 }).notNull(),
  accountEmail: varchar("accountEmail", { length: 200 }).notNull(),
  accountPassword: text("accountPassword").notNull(),
  accountNote: text("accountNote"),
  priceKs: int("priceKs").default(0).notNull(),
  paymentMethod: varchar("paymentMethod", { length: 60 }),
  status: mysqlEnum("status", ["pending","processing","completed","rejected"]).default("pending").notNull(),
  adminNote: text("adminNote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Game Account Buy/Sell listings */
export const gameAccountListings = mysqlTable("gameAccountListings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  gameType: varchar("gameType", { length: 60 }).notNull(),
  uid: varchar("uid", { length: 120 }),
  ign: varchar("ign", { length: 120 }),
  rank: varchar("rank", { length: 80 }),
  loginMethod: varchar("loginMethod", { length: 200 }),
  accountDetails: text("accountDetails"),
  screenshotUrl: text("screenshotUrl"),
  sellerPriceKs: int("sellerPriceKs").default(0).notNull(),
  adminBuyPriceKs: int("adminBuyPriceKs").default(0).notNull(),
  adminSellPriceKs: int("adminSellPriceKs").default(0).notNull(),
  adminCredentials: text("adminCredentials"),
  status: mysqlEnum("status", ["pending","approved","listed","sold","rejected"]).default("pending").notNull(),
  adminNote: text("adminNote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InsertRankBoostOrder = typeof rankBoostOrders.$inferInsert;
export type InsertGameAccountListing = typeof gameAccountListings.$inferInsert;
