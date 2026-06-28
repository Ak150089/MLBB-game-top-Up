import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type Lang = "en" | "my";

type Dict = Record<string, { en: string; my: string }>;

// Central translation dictionary. Keep keys flat and descriptive.
const DICT: Dict = {
  "brand.tagline": { en: "Instant game top-ups & premium apps", my: "Game ဖြည့်ခြင်းနှင့် Premium App များ — အလျင်အမြန်" },
  "nav.home": { en: "Home", my: "ပင်မ" },
  "nav.help": { en: "Help", my: "ကူညီမှု" },
  "nav.history": { en: "Orders", my: "မှာယူမှုများ" },
  "nav.spin": { en: "Spin", my: "လည်ပတ်" },
  "nav.leaderboard": { en: "Top Users", my: "ထိပ်တန်းသုံးစွဲသူ" },
  "nav.admin": { en: "Admin", my: "Admin" },
  "nav.balance": { en: "Balance", my: "လက်ကျန်ငွေ" },
  "nav.login": { en: "Log in", my: "အကောင့်ဝင်" },
  "nav.profile": { en: "Profile", my: "ပရိုဖိုင်" },
  "profile.title": { en: "My Profile", my: "ကျွန်ုပ်၏ ပရိုဖိုင်" },
  "profile.loginPrompt": { en: "Log in to view your profile", my: "ပရိုဖိုင် ကြည့်ရန် အကောင့်ဝင်ပါ" },
  "profile.member": { en: "Member", my: "အသင်းဝင်" },
  "profile.memberSince": { en: "Member since", my: "အသင်းဝင်ခဲ့သည်" },
  "profile.balance": { en: "Wallet Balance", my: "ပိုက်ဆံအိတ် လက်ကျန်" },
  "profile.topUp": { en: "Top Up", my: "ဖြည့်မည်" },
  "profile.allOrders": { en: "Orders", my: "အော်ဒါများ" },
  "profile.deposits": { en: "Deposits", my: "ငွေဖြည့်မှုများ" },
  "profile.recentOrders": { en: "Recent Orders", my: "လတ်တလော အော်ဒါများ" },
  "profile.recentDeposits": { en: "Recent Deposits", my: "လတ်တလော ငွေဖြည့်မှုများ" },
  "profile.noDeposits": { en: "No deposits yet", my: "ငွေဖြည့်မှု မရှိသေးပါ" },
  "profile.viewAll": { en: "View all", my: "အားလုံးကြည့်" },
  "profile.settings": { en: "Settings", my: "ဆက်တင်များ" },
  "profile.language": { en: "Language", my: "ဘာသာစကား" },
  "profile.adminPanel": { en: "Admin Panel", my: "Admin Panel" },
  "profile.logout": { en: "Log out", my: "ထွက်မည်" },
  "nav.logout": { en: "Log out", my: "ထွက်မည်" },

  "cat.popular": { en: "Popular Games", my: "လူကြိုက်များ Games" },
  "cat.premium": { en: "Premium Apps", my: "Premium Apps" },
  "premium.tagline": { en: "Premium subscription • instant activation", my: "Premium subscription • ချက်ချင်း activate" },
  "cat.other": { en: "Other Games", my: "အခြား Games" },

  "home.heroTitle": { en: "Top up. Power up. Win more.", my: "ဖြည့်လိုက်၊ အားဖြည့်လိုက်၊ ပိုနိုင်လိုက်။" },
  "home.heroSub": { en: "Diamonds, UC, premium apps — delivered fast with secure manual payment.", my: "Diamonds, UC, premium app များ — လုံခြုံစွာ အလျင်အမြန် ပို့ပေးသည်။" },
  "home.cta": { en: "Browse games", my: "Games ကြည့်မည်" },
  "home.viewAll": { en: "View all", my: "အားလုံးကြည့်" },
  "home.topup": { en: "Top Up", my: "ဖြည့်မည်" },

  "product.choosePackage": { en: "Choose a package", my: "Package ရွေးပါ" },
  "product.gameUserId": { en: "Game User ID", my: "Game User ID" },
  "product.serverId": { en: "Server ID", my: "Server ID" },
  "product.paymentMethod": { en: "Payment method", my: "ငွေပေးချေမှု" },
  "product.uploadReceipt": { en: "Upload payment receipt", my: "ငွေလွှဲ ပြေစာတင်ပါ" },
  "product.receiptHint": { en: "Pay to the account below, then upload your screenshot.", my: "အောက်ပါ account သို့ လွှဲပြီး screenshot တင်ပါ။" },
  "product.submit": { en: "Submit order", my: "Order တင်မည်" },
  "product.total": { en: "Total", my: "စုစုပေါင်း" },
  "product.payInstr": { en: "Payment instructions", my: "ငွေပေးချေရန် ညွှန်ကြားချက်" },
  "product.selectFirst": { en: "Select a package first", my: "Package အရင်ရွေးပါ" },
  "product.loginToOrder": { en: "Log in to order", my: "မှာယူရန် အကောင့်ဝင်ပါ" },
  "product.orderPlaced": { en: "Order placed! Track it in Orders.", my: "Order တင်ပြီးပါပြီ! Orders မှာ ကြည့်နိုင်ပါသည်။" },
  "product.popular": { en: "POPULAR", my: "ရေပန်းစား" },

  "history.title": { en: "My Orders", my: "ကျွန်ုပ်၏ Orders" },
  "history.empty": { en: "No orders yet", my: "Order မရှိသေးပါ" },
  "history.emptySub": { en: "Your top-up orders will appear here.", my: "သင့် order များ ဒီနေရာတွင် ပေါ်လာပါမည်။" },

  "status.pending": { en: "Pending", my: "စောင့်ဆိုင်းဆဲ" },
  "status.processing": { en: "Processing", my: "ဆောင်ရွက်ဆဲ" },
  "status.completed": { en: "Completed", my: "ပြီးစီး" },
  "status.failed": { en: "Failed", my: "မအောင်မြင်" },

  "spin.title": { en: "Daily Spin Wheel", my: "နေ့စဉ် လည်ပတ်ဘီး" },
  "spin.sub": { en: "Spin once a day for bonus rewards!", my: "နေ့စဉ် တစ်ကြိမ် လည်ပတ်ပြီး ဆုလက်ဆောင်ရယူပါ!" },
  "spin.spinNow": { en: "SPIN", my: "လည်ပတ်" },
  "spin.spinning": { en: "Spinning...", my: "လည်နေသည်..." },
  "spin.comeBack": { en: "Come back in", my: "ပြန်လာရန်" },
  "spin.youWon": { en: "You won", my: "သင်ရရှိသည်" },
  "spin.history": { en: "Recent spins", my: "လတ်တလော လည်ပတ်မှု" },
  "spin.loginPrompt": { en: "Log in to spin the wheel", my: "လည်ပတ်ရန် အကောင့်ဝင်ပါ" },

  "lb.title": { en: "Top Users", my: "ထိပ်တန်း သုံးစွဲသူများ" },
  "lb.sub": { en: "Highest spenders this season", my: "ဤရာသီ၏ အသုံးအများဆုံး" },
  "lb.empty": { en: "No spenders yet", my: "ဒေတာ မရှိသေးပါ" },
  "lb.rank": { en: "Rank", my: "အဆင့်" },
  "lb.user": { en: "User", my: "အသုံးပြုသူ" },
  "lb.spent": { en: "Total Spent", my: "စုစုပေါင်းသုံးငွေ" },

  "admin.title": { en: "Admin Panel", my: "Admin Panel" },
  "admin.dashboard": { en: "Dashboard", my: "Dashboard" },
  "admin.orders": { en: "Orders", my: "Orders" },
  "admin.products": { en: "Products", my: "Products" },
  "admin.payments": { en: "Payments", my: "ငွေပေးချေမှု" },
  "admin.totalOrders": { en: "Total Orders", my: "စုစုပေါင်း Orders" },
  "admin.pending": { en: "Pending", my: "စောင့်ဆိုင်း" },
  "admin.revenue": { en: "Revenue", my: "ဝင်ငွေ" },
  "admin.products.count": { en: "Products", my: "Products" },
  "admin.approve": { en: "Approve", my: "အတည်ပြု" },
  "admin.reject": { en: "Reject", my: "ငြင်းပယ်" },
  "admin.viewReceipt": { en: "View receipt", my: "ပြေစာကြည့်" },
  "admin.noReceipt": { en: "No receipt", my: "ပြေစာမရှိ" },
  "admin.markProcessing": { en: "Mark Processing", my: "Processing သတ်မှတ်" },
  "admin.adminOnly": { en: "Admins only", my: "Admin များသာ" },
  "admin.notAdmin": { en: "You don't have admin access.", my: "သင့်တွင် admin ခွင့်မရှိပါ။" },
  "admin.branding": { en: "Branding", my: "အမှတ်တံဆိပ်" },
  "admin.banners": { en: "Banners", my: "ဘန်နာ" },
  "admin.prizes": { en: "Spin Prizes", my: "ဆုလက်ဆောင်" },
  "admin.brandName": { en: "Brand name", my: "အမှတ်တံဆိပ်အမည်" },
  "admin.logo": { en: "Logo", my: "လိုဂို" },
  "admin.tagline": { en: "Tagline (English)", my: "ဆောင်ပုဒ် (English)" },
  "admin.taglineMy": { en: "Tagline (Myanmar)", my: "ဆောင်ပုဒ် (မြန်မာ)" },
  "admin.saved": { en: "Saved", my: "သိမ်းပြီးပါပြီ" },
  "admin.newBanner": { en: "New Banner", my: "ဘန်နာအသစ်" },
  "admin.newPrize": { en: "New Prize", my: "ဆုအသစ်" },
  "admin.weight": { en: "Win chance (weight)", my: "နိုင်ခြေ (weight)" },

  "common.loading": { en: "Loading...", my: "ဖွင့်နေသည်..." },
  "common.back": { en: "Back", my: "နောက်သို့" },
  "common.cancel": { en: "Cancel", my: "ပယ်ဖျက်" },
  "common.save": { en: "Save", my: "သိမ်းမည်" },
  "common.delete": { en: "Delete", my: "ဖျက်မည်" },
  "common.edit": { en: "Edit", my: "ပြင်မည်" },
  "common.add": { en: "Add", my: "ထည့်မည်" },
  "common.optional": { en: "optional", my: "ရွေးချယ်နိုင်" },
  "common.ks": { en: "Ks", my: "ကျပ်" },
  "common.copy": { en: "Copy", my: "ကူးယူ" },
  "common.copied": { en: "Copied!", my: "ကူးယူပြီး!" },

  "nav.wallet": { en: "Wallet", my: "ပိုက်အိတ်" },
  "balance.title": { en: "My Balance", my: "ကျွန်ုပ်ငွေ" },
  "balance.current": { en: "Current balance", my: "လက်ရှိလက်ကျန်ငွေ" },
  "balance.add": { en: "Add Balance", my: "ငွေဖြည့်မည်" },
  "balance.history": { en: "Transaction history", my: "ငွေလွှဲမှတ်တမ်း" },
  "balance.empty": { en: "No transactions yet", my: "မှတ်တမ်း မရှိသေးပါ" },
  "balance.loginPrompt": { en: "Log in to view your balance", my: "လက်ကျန်ငွေကြည့်ရန် အကောင့်ဝင်ပါ" },
  "balance.payWith": { en: "Pay with Balance", my: "လက်ကျန်ငွေဖြင့် ပေးချေမည်" },
  "balance.insufficient": { en: "Insufficient balance", my: "လက်ကျန်ငွေ မလုံလောက်ပါ" },

  "deposit.title": { en: "Add Balance", my: "ငွေဖြည့်မည်" },
  "deposit.amount": { en: "Amount (Ks)", my: "ပမာဏ (ကျပ်)" },
  "deposit.chooseMethod": { en: "Choose payment method", my: "ငွေပေးချေမှုနည်းလမ်းရွေးပါ" },
  "deposit.create": { en: "Continue", my: "ဆက်လုပ်မည်" },
  "deposit.sendTo": { en: "Send payment to", my: "ငွေလွှဲရန်" },
  "deposit.memo": { en: "Payment note / memo", my: "ငွေလွှဲ note (memo)" },
  "deposit.memoHint": { en: "Include this exact note in your transfer so we can match it.", my: "ငွေလွှဲရာတွင် ဤ note အတိအကျ ထည့်ပေးပါ။" },
  "deposit.tonPay": { en: "Ton နဲ့ပေးချေမည်", my: "Ton နဲ့ပေးချေမည်" },
  "deposit.tonAmount": { en: "TON amount to send", my: "ပို့ရမည့် TON ပမာဏ" },
  "deposit.verify": { en: "I have paid — Verify", my: "ငွေလွှဲပြီးပါပြီ — စစ်ဆေးမည်" },
  "deposit.verifying": { en: "Verifying...", my: "စစ်ဆေးနေဆဲ..." },
  "deposit.verified": { en: "Payment verified! Balance updated.", my: "ငွေပေးချေမှု အတည်ပြုပြီး! လက်ကျန်ငွေ ပြင်ပြီးပါပြီ။" },
  "deposit.notFound": { en: "Payment not found yet. Wait a moment and try again.", my: "ငွေပေးချေမှု မတွေ့သေးပါ။ ခဏစောင့်ပြီး ထပ်ကြိုးစားပါ။" },
  "deposit.uploadReceipt": { en: "Upload receipt for admin approval", my: "Admin အတည်ပြုရန် ပြေစာတင်ပါ" },
  "deposit.submitted": { en: "Receipt submitted. We'll credit your balance after review.", my: "ပြေစာတင်ပြီးပါပြီ။ စိစစ်ပြီးလျှင် လက်ကျန်ငွေ ထည့်ပေးပါမည်။" },
  "deposit.pendingReview": { en: "Pending admin review", my: "Admin စိစစ်ရန် စောင့်ဆိုင်းဆဲ" },

  "admin.deposits": { en: "Deposits", my: "ငွေဖြည့်မှုများ" },
  "admin.depositAmount": { en: "Amount", my: "ပမာဏ" },
  "admin.depositMethod": { en: "Method", my: "နည်းလမ်း" },
  "admin.contactEmail": { en: "Contact email", my: "ဆက်သွယ်ရန် Email" },
  "admin.usdRate": { en: "USD to Ks rate", my: "USD မှ Ks နှုန်း" },
};

type LanguageContextValue = {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === "undefined") return "my";
    return (localStorage.getItem("lang") as Lang) || "my";
  });

  useEffect(() => {
    localStorage.setItem("lang", lang);
    document.documentElement.lang = lang === "my" ? "my" : "en";
  }, [lang]);

  const setLang = useCallback((l: Lang) => setLangState(l), []);
  const toggle = useCallback(() => setLangState(p => (p === "en" ? "my" : "en")), []);
  const t = useCallback(
    (key: string) => {
      const entry = DICT[key];
      if (!entry) return key;
      return entry[lang];
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, toggle, t }), [lang, setLang, toggle, t]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be used within LanguageProvider");
  return ctx;
}

// Format a number as Myanmar Kyat. Always uses the "Ks" label per spec.
export function formatKs(n: number | null | undefined): string {
  return new Intl.NumberFormat("en-US").format(n || 0) + " Ks";
}
