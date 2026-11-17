import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export const BUCKET = "listing-photos";
export const MAX_PHOTO_MB = 5;

// Public columns only. seller_email is never sent to the browser.
export const PUBLIC_COLS = "id,title,description,price,category,image_url,created_at,sold,buyable";

export const CATEGORIES = [
  { slug: "electronics", label: "Electronics" },
  { slug: "home", label: "Home & Kitchen" },
  { slug: "clothing", label: "Clothing" },
  { slug: "books", label: "Books & School" },
  { slug: "vehicles", label: "Vehicles" },
  { slug: "hobbies", label: "Hobbies & Toys" },
  { slug: "other", label: "Other" },
];

export const categoryLabel = (slug) =>
  CATEGORIES.find((c) => c.slug === slug)?.label ?? "Other";

const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});
export const formatPrice = (n) => (Number(n) === 0 ? "Free" : peso.format(n));

export function timeAgo(iso) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso)) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} day${d > 1 ? "s" : ""} ago`;
  return new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

// Strip characters that would break a PostgREST or() filter.
export const cleanSearch = (q) => (q || "").replace(/[,()%*\\:."']/g, " ").trim().slice(0, 60);
