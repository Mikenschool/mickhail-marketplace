"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  supabase, PUBLIC_COLS, CATEGORIES, categoryLabel, formatPrice, timeAgo, cleanSearch,
} from "./supabase";

function Tabs({ cat, q }) {
  const href = (slug) => {
    const p = new URLSearchParams();
    if (slug) p.set("cat", slug);
    if (q) p.set("q", q);
    const s = p.toString();
    return s ? `/?${s}` : "/";
  };
  return (
    <nav className="tabs" aria-label="Categories">
      <Link href={href(null)} className={`tab${!cat ? " on" : ""}`} aria-current={!cat ? "page" : undefined}>
        All
      </Link>
      {CATEGORIES.map((c) => (
        <Link
          key={c.slug}
          href={href(c.slug)}
          className={`tab${cat === c.slug ? " on" : ""}`}
          aria-current={cat === c.slug ? "page" : undefined}
        >
          {c.label}
        </Link>
      ))}
    </nav>
  );
}

function Card({ item }) {
  return (
    <li>
      <Link href={`/listing/${item.id}`} className="card">
        <div className="card-img">
          <img src={item.image_url} alt="" loading="lazy" />
          {item.sold && <span className="badge sold">Sold</span>}
          {!item.sold && item.buyable && <span className="badge buy">Buy now</span>}
        </div>
        <div className="card-body">
          <p className="price">{formatPrice(item.price)}</p>
          <h3 className="card-title">{item.title}</h3>
          <p className="meta">
            {categoryLabel(item.category)} · {timeAgo(item.created_at)}
          </p>
        </div>
      </Link>
    </li>
  );
}

function Listings() {
  const params = useSearchParams();
  const rawCat = params.get("cat");
  const cat = CATEGORIES.some((c) => c.slug === rawCat) ? rawCat : null;
  const q = cleanSearch(params.get("q"));

  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [view, setView] = useState("grid");

  useEffect(() => {
    try {
      const v = localStorage.getItem("view");
      if (v === "list" || v === "grid") setView(v);
    } catch {}
  }, []);

  function changeView(v) {
    setView(v);
    try { localStorage.setItem("view", v); } catch {}
  }

  useEffect(() => {
    let live = true;
    setItems(null);
    setError("");
    let query = supabase
      .from("listings")
      .select(PUBLIC_COLS)
      .order("created_at", { ascending: false })
      .limit(120);
    if (cat) query = query.eq("category", cat);
    if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
    query.then(({ data, error }) => {
      if (!live) return;
      if (error) setError("Couldn't load listings. Check your connection and refresh.");
      else setItems(data);
    });
    return () => { live = false; };
  }, [cat, q]);

  const heading = q
    ? `Results for “${q}”${cat ? ` in ${categoryLabel(cat)}` : ""}`
    : cat ? categoryLabel(cat) : "Today's picks";

  return (
    <main className="wrap">
      <Tabs cat={cat} q={q} />

      <div className="bar">
        <h1 className="h1">{heading}</h1>
        <div className="view" role="group" aria-label="Layout">
          <button type="button" aria-pressed={view === "grid"} onClick={() => changeView("grid")}>Grid</button>
          <button type="button" aria-pressed={view === "list"} onClick={() => changeView("list")}>List</button>
        </div>
      </div>

      {error && <p className="notice err" role="alert">{error}</p>}

      {!error && items === null && (
        <ul className={`grid ${view}`} aria-hidden="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <li key={i}><div className="card skel"><div className="card-img" /><div className="card-body"><span /><span /></div></div></li>
          ))}
        </ul>
      )}

      {items && items.length === 0 && (
        <div className="empty">
          <p className="empty-h">{q || cat ? "Nothing here yet." : "No listings yet."}</p>
          <p>
            {q ? "Try a different word, or " : ""}
            <Link href="/sell">post the first one</Link>.
          </p>
        </div>
      )}

      {items && items.length > 0 && (
        <>
          <p className="count" aria-live="polite">{items.length} listing{items.length > 1 ? "s" : ""}</p>
          <ul className={`grid ${view}`}>
            {items.map((it) => <Card key={it.id} item={it} />)}
          </ul>
        </>
      )}
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<main className="wrap" />}>
      <Listings />
    </Suspense>
  );
}
