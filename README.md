# Palengke: a mini marketplace

SUpost hiring Tests 3 and 4. A small Facebook-style marketplace built with **React + Next.js 16 (App Router)**, **Supabase** (Postgres + Storage) and **Stripe Connect**, hosted on **Vercel**.

**Live:** https://mickhail-marketplace.vercel.app

## Test 4: Stripe Connect
- **Seller onboarding** (`/connect`): the seller enters the email on their listings and finishes Stripe's hosted onboarding (Account Links). Their connected account ID is saved in the `sellers` table. `/connect/return` checks the account and turns on Buy now for all their listings.
- **Buy Now** (`/listing/[id]`): shown only when the seller is onboarded and the item isn't sold. It opens **Stripe Checkout** as a **direct charge** on the seller's account, with a **10% `application_fee_amount`** for the platform.
- **Success page** (`/success`): reads the Checkout Session from Stripe and shows the total, the seller's share and the 10% fee.
- **Orders**: each paid session is saved in `orders` (amount, fee, currency, account, session ID) and the listing is marked **Sold**. Recording is idempotent (`on conflict do nothing`), so a repeat call never makes a second order.
- **Webhook** (`/api/stripe/webhook`): verifies the signature and handles `checkout.session.completed` (records the order) and `account.updated` (updates onboarding status).

### Notes on the shared sandbox
- The sandbox already has the maximum of 16 test webhook endpoints (made by other candidates), so Stripe would not let me add mine. The webhook code is ready; `node setup-stripe.mjs` adds it when a slot is free. Until then the success page saves the order and marks the item Sold. It confirms payment with Stripe on the server first, so the browser can't fake an order.
- The sandbox rejects the legacy `type: "express"` field. Accounts are created with `controller` settings instead: Express dashboard, Stripe collects the requirements and takes the losses. This sandbox only allows that on the preview API version, so only that one call uses it.

### Security
- The secret key, server token and webhook secret live only in environment variables. Nothing secret is committed (see `.env.example`).
- The `sellers` and `orders` tables have no public access. The server reaches them only through `SECURITY DEFINER` functions that check a server-only token.
- Buyers can't set `sold` or `buyable` themselves. A trigger and column grants control both.
- When saving an order, the database checks that the paying account is really the listing's seller.

Screenshots are in `screenshots-test4/`.

## Test 3: the marketplace
- **Create listing** (`/sell`): photo, title, description, price (₱), email and category. The photo goes to Supabase Storage and the listing is saved in Postgres. Every field is checked before upload, and the photo must be an image of 5 MB or less.
- **Browse** (`/`): all listings, newest first, with category tabs and a grid/list switch (your choice is remembered).
- **Keyword search** (bonus): the search box matches the title and description, and works together with the category tabs.
- **Listing page** (`/listing/[id]`): large photo, price, category, time posted and full description.
- **Message Seller**: saves the buyer's name, email and message in the `messages` table.

### Privacy choices
- The seller's email is saved but **never sent to the browser**. The public role can only `SELECT` the safe columns (column-level grants).
- Buyer messages are **insert-only** for the public.
- No login is needed, as the brief says.

## Run it
1. Run `supabase-setup.sql`, then `stripe-setup.sql` (replace `CHANGE_ME` with your own random server token) in the Supabase SQL editor.
2. Copy `.env.example` to `.env.local` and fill in Supabase, the same server token, and your Stripe sandbox keys.
3. `npm install`, then `npm run dev`.
4. Optional: `node setup-stripe.mjs` creates the Connect webhook and saves the env vars in Vercel.

Test card: `4242 4242 4242 4242`, any future date, any CVC. The 3 listings marked "Sample" are illustrations I added, not real items.

Built by Mickhail Felismino with help from Claude (AI). I tested every flow by hand: onboarding, checkout, success page and the saved order.
