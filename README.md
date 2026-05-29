# Crypto Pay (MVP)

Venmo-like **USDC on Base** payments with **embedded wallets** (Privy), **usernames**, and **pay-by-link** sessions.

## What’s implemented

- PWA from day 1 (manifest + Serwist service worker)
- Privy login (email/SMS) + embedded wallet
- USDC balance read on Base
- Choose a `@username`
- Send USDC to `@username`
- Request link: `/s/{code}` and pay flow
- Basic activity feed (sent transfers + created/received requests)

## Setup

### 1) Install

```bash
cd crypto-pay
npm install
```

### 2) Configure env

Copy `.env.example` → `.env.local` and fill:

- **Client**:
  - `NEXT_PUBLIC_PRIVY_APP_ID`
  - `NEXT_PUBLIC_BASE_RPC_URL` (optional; defaults to Base public RPC)
  - `NEXT_PUBLIC_USDC_ADDRESS` (optional; defaults to Base USDC)
- **Server**:
  - `PRIVY_APP_ID`
  - `PRIVY_APP_SECRET`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

### 3) Create database tables

Run the SQL in:

- `supabase/schema.sql`

in your Supabase SQL editor.

### 4) Run

```bash
npm run dev
```

Open `http://localhost:3000`.

## Notes (MVP limitations)

- The `/api/sessions/[code]/pay` endpoint **records** the tx hash but does **not** verify on-chain receipt yet.
- RLS policies are not fully designed; MVP uses server-side Supabase service role for writes/reads.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
