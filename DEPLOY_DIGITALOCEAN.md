# Digital Ocean Deployment Guide — Game Top-Up Shop

ဒီ guide မှာ project ကို Digital Ocean App Platform မှာ တင်နည်းကို အဆင့်လိုက် ရှင်းပြထားပါတယ်။

---

## စစ်ဆေးချက် ရလဒ်

| အချက် | အဆင့် | မှတ်ချက် |
|-------|-------|---------|
| TypeScript compile | ✅ Error မရှိ | `pnpm check` pass |
| Production build | ✅ အောင်မြင် | `dist/index.js` + `dist/public/` |
| Test failures (7) | ⚠️ Database မ connect ရသေးလို့ | DO မှာ DB setup ပြီးရင် ဖြေရှင်းသွားမယ် |
| Port config | ✅ `$PORT` env var သုံးတယ် | DO က 8080 set ပေးမယ် |
| Static files | ✅ `dist/public/` မှာ မှန်ကန် | production path ကိုက်ညီ |

### Test Failures ရှင်းလင်းချက်

Test 7 ခု fail ဖြစ်တာက **code error မဟုတ်ပါ** — database table တွေ မရှိသေးလို့ (migration apply မဖြစ်ရသေးလို့) ဖြစ်ပါတယ်။ DO မှာ database setup ပြီးပြီ migration run ပြီးရင် test တွေ pass ဖြစ်မယ်။

---

## အဆင့် ၁ — GitHub မှာ Push လုပ်ပါ

```bash
cd game-topup-shop
git init
git add .
git commit -m "Initial deployment"
git remote add origin https://github.com/YOUR_USERNAME/game-topup-shop.git
git push -u origin main
```

---

## အဆင့် ၂ — DO Managed MySQL Database ဖန်တီးပါ

1. [Digital Ocean Console](https://cloud.digitalocean.com) → **Databases** → **Create Database**
2. Engine: **MySQL 8** | Region: **Singapore** (Myanmar နဲ့ အနီးဆုံး)
3. Plan: **Basic $15/mo** (1GB RAM) — dev/test အတွက် ဒါလုံလောက်တယ်
4. Database name: `game_topup_shop`
5. Create ပြီးရင် **Connection Details** ကနေ connection string ကူးထားပါ

### Database Tables ဖန်တီးပါ

DO Database Console (သို့) MySQL client ကနေ `drizzle/init_all.sql` ကို run ပါ:

```bash
mysql -h YOUR_DB_HOST -u YOUR_DB_USER -p YOUR_DB_NAME < drizzle/init_all.sql
```

သို့မဟုတ် DO Console → Database → **Query** tab မှာ `init_all.sql` ထဲက SQL ကို paste လုပ်ပြီး run ပါ။

---

## အဆင့် ၃ — DO App Platform မှာ App ဖန်တီးပါ

1. **Apps** → **Create App**
2. Source: **GitHub** → သင့် repo ရွေးပါ → Branch: `main`
3. **Auto-detect** → Node.js ကို ရွေးမယ်
4. Build Command: `npm install --legacy-peer-deps && npm run build`
5. Run Command: `npm start`
6. HTTP Port: `8080`

### Environment Variables ထည့်ပါ

App Settings → **Environment Variables** မှာ အောက်ပါ variable တွေ ထည့်ပါ:

| Variable | Value | Type |
|----------|-------|------|
| `NODE_ENV` | `production` | Plain |
| `DATABASE_URL` | `mysql://user:pass@host:25060/game_topup_shop?ssl={"rejectUnauthorized":true}` | Secret |
| `JWT_SECRET` | Random 32+ char string | Secret |
| `VITE_APP_ID` | Manus App ID | Secret |
| `OAUTH_SERVER_URL` | `https://api.manus.im` | Plain |
| `VITE_OAUTH_PORTAL_URL` | `https://manus.im` | Plain |
| `OWNER_OPEN_ID` | သင့် Manus openId | Secret |
| `PORT` | `8080` | Plain |
| `BUILT_IN_FORGE_API_URL` | `https://api.manus.im` | Plain |
| `BUILT_IN_FORGE_API_KEY` | Forge API Key | Secret |
| `VITE_FRONTEND_FORGE_API_KEY` | Frontend Forge Key | Secret |
| `VITE_FRONTEND_FORGE_API_URL` | `https://api.manus.im` | Plain |

**Optional (Binance/TON auto-verify မသုံးရင် ထည့်စရာ မလို):**

| Variable | Value |
|----------|-------|
| `TON_WALLET_ADDRESS` | TON wallet address |
| `TON_API_KEY` | TON API key |
| `BINANCE_MERCHANT_ID` | Binance merchant ID |
| `BINANCE_API_KEY` | Binance API key |
| `BINANCE_SECRET_KEY` | Binance secret key |

---

## အဆင့် ၄ — JWT_SECRET ဖန်တီးနည်း

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

ဒီ command ကနေ ရလာတဲ့ string ကို `JWT_SECRET` မှာ ထည့်ပါ။

---

## အဆင့် ၅ — Deploy

**Save and Deploy** ကို နှိပ်ပါ။ DO က:
1. GitHub ကနေ code pull လုပ်မယ်
2. `npm install && npm run build` run မယ်
3. `npm start` နဲ့ server စမယ်

Deploy ပြီးရင် DO က URL တစ်ခု ပေးမယ် (ဥပမာ `https://game-topup-shop-xxxxx.ondigitalocean.app`)

---

## Dockerfile နဲ့ Deploy (Alternative)

App Platform အစား **Container Registry** သုံးချင်ရင် —

```bash
# Build
docker build -t game-topup-shop .

# Test locally
docker run -p 8080:8080 --env-file .env game-topup-shop

# Push to DO Container Registry
doctl registry create game-topup-shop
docker tag game-topup-shop registry.digitalocean.com/YOUR_REGISTRY/game-topup-shop
docker push registry.digitalocean.com/YOUR_REGISTRY/game-topup-shop
```

---

## ပြဿနာ ဖြေရှင်းနည်း

### "Table doesn't exist" error
→ `drizzle/init_all.sql` ကို database မှာ run ပါ

### "Unknown column 'totalSpentKs'" error
→ Migration 0001 (`ALTER TABLE users ADD totalSpentKs`) run မဖြစ်ရသေးဘူး — `init_all.sql` ကို အစကနေ run ပါ

### Build fails with "VITE_APP_ID not set"
→ Environment Variables မှာ `VITE_APP_ID` ကို **Build Time** scope နဲ့ ထည့်ပါ

### 502 Bad Gateway
→ DO Logs မှာ ကြည့်ပါ — `PORT=8080` set ဖြစ်ဖြစ်မဖြစ် စစ်ပါ

---

## ကုန်ကျစရိတ် ခန့်မှန်းချက်

| Service | Plan | $/month |
|---------|------|---------|
| App Platform (web) | Basic XXS (512MB) | $5 |
| Managed MySQL | Basic 1GB | $15 |
| **Total** | | **~$20/mo** |

Traffic များလာရင် App ကို Basic XS ($10) သို့ upgrade လုပ်ပါ။
