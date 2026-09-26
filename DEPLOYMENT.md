# Deploying InvestorPlugX to Vercel + Neon

This app is a Next.js 16 server-rendered site with PostgreSQL via Prisma. The
recommended cloud setup is **Vercel** (hosting) + **Neon** (managed Postgres).

---

## 0. Before you start — rotate your secrets

Every key below was shared in a plaintext chat, so treat it as **compromised**
and regenerate it. Do not reuse the values currently in your local `.env`.

| Secret | Where to regenerate |
|---|---|
| `DATABASE_URL` password | Neon dashboard → your project → Reset password |
| `NEXTAUTH_SECRET` | Generate a new one (see below) |
| `XCLUSIVE_PLUGS_API_KEY` | XclusivePlugs → API access |
| `SMS_PROVIDER_API_KEY` | Your SMS provider account |
| `SMM_PROVIDER_API_KEY` | ReallySimpleSocial → API |
| `CRON_SECRET` | Generate a new one (see below) |
| `MOCK_WEBHOOK_SECRET` | Generate a new one (see below) |

Generate fresh random values:

```bash
node -e "const c=require('crypto');console.log('NEXTAUTH_SECRET='+c.randomBytes(32).toString('base64'));console.log('CRON_SECRET='+c.randomBytes(32).toString('hex'));console.log('MOCK_WEBHOOK_SECRET='+c.randomBytes(32).toString('hex'))"
```

---

## 1. Create the database (Neon)

1. Sign up at <https://neon.tech> and create a project.
2. Copy the **pooled** connection string. It looks like:
   ```
   postgresql://USER:PASSWORD@ep-xxx-pooler.REGION.aws.neon.tech/DBNAME?sslmode=require
   ```
3. **Use the pooled host** (`-pooler` in the name). Vercel runs many short-lived
   serverless instances, and the pooler keeps them from exhausting Postgres
   connections. In Neon's Connect dialog, pick "Pooled connection".

> The migrations are applied automatically by the Vercel build step
> (`prisma migrate deploy`), so you do not need to run them by hand.

---

## 2. Deploy to Vercel

1. Push this repo to GitHub (make sure `.env` is **not** committed — it is
   already gitignored).
2. Go to <https://vercel.com/new> and import the repository.
3. Vercel reads `vercel.json`, so the framework and build command are
   preconfigured. Do not override the build command.
4. Under **Environment Variables**, add every key from the table below.
5. Deploy. The first deploy runs migrations and builds the app.

### Required environment variables

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon **pooled** connection string |
| `NEXTAUTH_URL` | Your real URL, e.g. `https://investorplugx.com` — **no trailing slash** |
| `NEXTAUTH_SECRET` | Freshly generated |
| `CRON_SECRET` | Freshly generated |
| `XCLUSIVE_PLUGS_API_URL` | `https://xclusiveplugs.com/api/v1` |
| `XCLUSIVE_PLUGS_API_KEY` | Rotated key |
| `SMS_PROVIDER_BASE_URL` | `https://5sim.net` |
| `SMS_PROVIDER_API_KEY` | Rotated key |
| `SMS_PROVIDER_MOCK` | `false` |
| `SMS_PROFIT_MARKUP_NGN` | `1000` |
| `SMM_PROVIDER_BASE_URL` | `https://reallysimplesocial.com/api/v2` |
| `SMM_PROVIDER_API_KEY` | Rotated key |
| `SMM_PROVIDER_MOCK` | `false` |
| `SMM_MARKUP_PERCENT` | `40` |
| `PAYSTACK_SECRET_KEY` | Your live Paystack secret (`sk_live_...`) |
| `PAYSTACK_WEBHOOK_SECRET` | Same as above, or Paystack's webhook secret |
| `PAYMENT_PROVIDER_MOCK` | `false` |

### Variables that must NOT be set in production
- `MOCK_WEBHOOK_SECRET` — leave it unset. The mock payment path is disabled in
  production on purpose; setting it would re-open a forged-webhook hole.
- Any `*_MOCK=true` flag other than for a deliberate staging environment.

---

## 2b. Launching before payments are ready (current plan)

Deposits are gated behind `PAYMENTS_ENABLED`. **Leave it unset** for the first
launch. While it is off:

| Surface | Behaviour |
|---|---|
| `/dashboard/wallet` | Shows "Deposits are coming soon" instead of the form |
| `POST /api/payments/initialize` | `503 { code: "DEPOSITS_DISABLED" }` |
| `POST /api/payments/mock-confirm` | `404` (disabled in production) |
| `/payments/mockcheckout` | Renders a "Not available" page |

This is deliberate: the current deposit flow marks a transaction `COMPLETED`
without crediting `walletBalance`, so anyone who paid would lose their money.
The gate makes that impossible.

**Do not set `PAYMENTS_ENABLED=true` until all three are done:**

1. The callback verifies the payment with Paystack (`/transaction/verify/:ref`)
   instead of blindly setting `COMPLETED`.
2. The callback checks `tx.userId === session.user.id` (today it does not).
3. Both the webhook and the callback credit `walletBalance`, idempotently.

Everything else on the site (accounts, SMS, boosting, orders, signup, login) is
unaffected by the gate and is safe to run live.

---

## 3. What changed to make this deployable

These were fixed so a clean cloud build works:

1. **`prisma generate` now runs on install.**
   `src/generated/prisma` is gitignored, so Vercel's fresh checkout had no
   Prisma client and would have failed to compile. The `postinstall` script now
   runs `prisma generate` first.

2. **Migrations run automatically.**
   `vercel.json` sets the build command to `prisma generate && prisma migrate
   deploy && next build`, so the schema is applied on every deploy.

3. **Forged mock webhooks are refused.** Previously a hardcoded
   `"mock-secret-dev-only"` fallback meant *anyone* could POST a fake payment
   webhook and credit a wallet without paying. The mock path is now refused in
   production at two layers (`paymentProvider.ts` and the webhook route).

4. **Cron jobs are scheduled by GitHub Actions, not Vercel.**
   `.github/workflows/cron.yml` triggers `/api/cron/smm-status` every 5 min and
   `/api/cron/supplier-sync` every 6 h. Both send
   `Authorization: Bearer $CRON_SECRET`, which is exactly what the routes
   expect. Two repository settings are required: the **`SITE_URL` variable**
   (e.g. `https://investorplugx.com`) and the **`CRON_SECRET` secret**, under
   *Settings -> Secrets and variables -> Actions*.

   These were previously Vercel Cron entries in `vercel.json`. They cannot be
   there on the Hobby plan: Vercel rejects any cron that fires more than once
   per day, and that validation error **fails the whole build** --
   *"Hobby accounts are limited to daily cron jobs. This cron expression would
   run more than once per day."* Every deploy since that config was added has
   failed for this reason. See
   [Cron usage & pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing).

---

## 4. After the first deploy — verify

- [ ] Visit `/auth/signup` and create an account.
- [ ] Log in and confirm `/dashboard` loads.
- [ ] Open **Get SMS Numbers** — prices must show, and each must be the
      supplier base **+ ₦1,000**.
- [ ] View page source on the SMS page and search for `5sim`, `cost`,
      `markupPercent`. **None may appear.**
- [ ] Deposit a small real amount and confirm the webhook settles it.
- [ ] Check a real SMS purchase debits the wallet by the displayed price.

---

## 5. Going live checklist

- [ ] Custom domain added in Vercel (Settings → Domains) and DNS pointed.
- [ ] `NEXTAUTH_URL` updated to the custom domain, then redeploy.
- [ ] All `*_MOCK` flags set to `false`.
- [ ] Paystack switched from test to **live** keys.
- [ ] `MOCK_WEBHOOK_SECRET` is **not** set.
- [ ] `PAYMENTS_ENABLED` is **not** set (until the deposit flow is fixed).
- [ ] Neon backups/PITR enabled for your plan.
- [ ] Test a real ₦1 SMS order and a real deposit end to end.

---

## Local development is unchanged

`npm run dev` still works locally. The mock providers activate automatically
outside production, so you do not need live API keys to develop.


