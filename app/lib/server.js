// Server-only helpers. Never import this file from a "use client" component.
import "server-only";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

export const PLATFORM_FEE_PERCENT = 10;
export const CURRENCY = "php";

// Server talks to Supabase with the public key, but every important write is a
// SQL function that checks SERVER_TOKEN, which only the server knows.
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
const TOKEN = process.env.SERVER_TOKEN;

export async function rpc(name, args = {}) {
  const { data, error } = await db.rpc(name, { p_token: TOKEN, ...args });
  if (error) throw new Error(`${name}: ${error.message}`);
  return data;
}

export const toCentavos = (price) => Math.round(Number(price) * 100);
export const platformFee = (centavos) => Math.round((centavos * PLATFORM_FEE_PERCENT) / 100);

export function siteUrl(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  return new URL(req.url).origin;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const paymentsReady = () => Boolean(stripe && TOKEN);

export const json = (body, status = 200) => Response.json(body, { status });
