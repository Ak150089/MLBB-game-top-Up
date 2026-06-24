# Game Top-Up Shop — TODO

## Round 1 — Core platform
- [x] DB schema: users, products, packages, orders, payment accounts, spins, leaderboard
- [x] Backend tRPC: catalog, orders (S3 receipt upload), admin, leaderboard, spin
- [x] Dark gaming theme (pink/purple/gold), Myanmar font
- [x] Bilingual i18n (Myanmar / English toggle)
- [x] Home with 3 categories
- [x] Product detail + top-up order flow
- [x] Order history with status badges
- [x] Admin panel (dashboard, orders approve/reject, products, payments)
- [x] Leaderboard (top spenders)
- [x] Spin wheel (daily free spin)
- [x] Vitest tests
- [x] Mobile responsiveness check
- [x] Status labels exact: Pending, Processing, Completed, Failed
- [x] Category labels exact: Popular Games, Premium Apps, Other Games
- [x] Prices in Ks

## Future / Production notes (documented for launch, not blocking)
- [x] Documented: auth uses secure platform OAuth + JWT session; phone+password is an optional future add-on
- [x] Documented: real game IDs / live payment gateway to be wired before public launch


## Round 2 — Admin Customization & Premium Vibe
- [x] DB: site_settings table (brand name, logo, tagline) + hero_banners table + spin_prizes table + product photo upload
- [x] Backend: settings get/update procedures (admin)
- [x] Backend: hero banner CRUD (admin) — title, subtitle, badge, image, order
- [x] Backend: generic image upload procedure (base64 -> S3) for logos & banners
- [x] Backend: spin prize CRUD (admin add/edit/delete prizes + weight)
- [x] Admin UI: Branding tab (edit site name, logo upload, tagline)
- [x] Admin UI: Hero Banner manager (add/edit/delete)
- [x] Admin UI: Spin Prize manager (add/edit/delete prizes)
- [x] Admin UI: Product form uses PHOTO UPLOAD instead of image URL
- [x] Storefront: logo + brand name read from settings (dynamic)
- [x] Storefront: auto-moving hero carousel (one slide at a time, auto slide)
- [x] Storefront: Premium Apps section redesigned with Yuzumi-inspired premium vibe
- [x] Overall: stronger game vibe + premium vibe polish
- [x] Tests updated and passing

## Round 3 — Payment Integration + ShineAker Brand + User Balance

### Secrets
- [x] Store TON wallet address + TON API key (injected env)
- [x] Store Binance API key + secret key + merchant id (injected env)
- [x] Store mobile wallet number (KBZ/Wave/AYA: 09791890162)

### Payment Integration
- [x] Extend payment_accounts table for TON/Binance/mobile wallets + admin editable
- [x] TON auto-verify via TonAPI (check incoming tx with comment/amount)
- [ ] Binance auto-verify via Binance API (DEFERRED: no public webhook for P2P; using admin manual approve for now)
- [x] KBZ/Wave/AYA/UAB manual (admin approve with receipt)
- [x] Order checkout: payment method selection + account display
- [x] TON Deep Link payment button labeled 'Ton နဲ့ပေးချေမည်'

### User Balance System
- [x] Add user_balance + balance_transactions tables
- [x] Deposit flow (top up balance via any payment method)
- [x] "My Balance" page with current balance + history
- [x] Pay top-up orders using balance (auto deduct + auto-refund on fail)
- [x] Admin approve balance deposits (Deposits tab)
- [x] Spin reward auto-credited to balance
- [x] Admin-configurable USD->Ks exchange rate

### ShineAker Brand + Remove Manus
- [x] Update site settings: brand = ShineAker, contact = shineaker@gmail.com
- [x] No user-facing "Powered by Manus" branding (orphan ManusDialog unused)
- [x] Footer with ShineAker + contact email
- [x] Home hero carousel + game grid (existing)
- [x] Responsive phone view verified

### Testing & Delivery
- [x] Tests for price conversion / payment helpers (4/4 pass)
- [x] Automated tests for balance deduct/refund + deposit verify flows (6/6 pass)
- [x] Full suite: 26/26 tests pass (1 Binance skipped for geo-restriction, 2 deposit admin skipped)
- [x] Screenshots phone view (home, balance, product)
- [x] Checkpoint

### Known gaps / follow-ups
- [ ] Payment account edit/update (currently create + delete only)
- [ ] Deposit method UI reads dynamically from admin-managed accounts (currently a fixed list)
- [ ] Binance auto-verify (deferred — manual approval in place)
- [ ] Deposit admin approval/rejection automated tests (manual UI testing available in admin panel)
