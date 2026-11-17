"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function SearchBox() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  useEffect(() => setQ(params.get("q") ?? ""), [params]);

  function submit(e) {
    e.preventDefault();
    const next = new URLSearchParams();
    const cat = params.get("cat");
    if (cat) next.set("cat", cat);
    if (q.trim()) next.set("q", q.trim());
    const s = next.toString();
    router.push(s ? `/?${s}` : "/");
  }

  return (
    <form className="search" role="search" onSubmit={submit}>
      <label htmlFor="q" className="sr">Search listings</label>
      <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
        <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="m20 20-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        id="q"
        type="search"
        placeholder="Search Palengke"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        maxLength={60}
        enterKeyHint="search"
      />
    </form>
  );
}

export default function Header() {
  return (
    <header className="top">
      <div className="top-in">
        <Link href="/" className="brand" aria-label="Palengke home">
          <span className="brand-mark" aria-hidden="true">P</span>
          <span className="brand-name">Palengke</span>
        </Link>
        <Suspense fallback={<div className="search" />}>
          <SearchBox />
        </Suspense>
        <Link href="/sell" className="btn btn-primary sell-btn">
          <span aria-hidden="true">+</span> Sell
        </Link>
      </div>
    </header>
  );
}
