# Palengke: a mini marketplace

SUpost hiring Test 3. A small Facebook-style marketplace built with **React + Next.js 16 (App Router)** and **Supabase** (Postgres + Storage), hosted on **Vercel**.

**Live:** https://mickhail-marketplace.vercel.app

## What works
- **Create listing** (`/sell`): photo, title, description, price (₱), email and category. The photo goes to Supabase Storage and the listing is saved in Postgres. Every field is checked before upload, and the photo must be an image of 5 MB or less.
- **Browse** (`/`): all listings, newest first, with category tabs and a grid/list switch (your choice is remembered).
- **Keyword search** (bonus): the search box matches the title and description, and works together with the category tabs.
- **Listing page** (`/listing/[id]`): large photo, price, category, time posted and full description.
- **Message Seller**: saves the buyer's name, email and message in the `messages` table.

## Privacy choices
- The seller's email is saved but **never sent to the browser**. The public role can only `SELECT` the safe columns (column-level grants), so `select=seller_email` returns *permission denied*.
- Buyer messages are **insert-only** for the public: nobody can read other people's messages through the API.
- No login is needed, as the brief says.

## Not done
- Sending the seller a real email (bonus) needs an email service account (e.g. Resend), so I left it out for now. The messages are saved and ready for it.

## Run it
1. Run `supabase-setup.sql` in the Supabase SQL editor (tables, row level security, grants and the `listing-photos` bucket).
2. Copy `.env.example` to `.env.local` and fill in your project URL and anon key.
3. `npm install`, then `npm run dev`.

The 3 listings marked "Sample" are illustrations I added to show the layout, not real items.

Built by Mickhail Felismino with help from Claude (AI). I tested every flow by hand, on both phone and desktop sizes.
