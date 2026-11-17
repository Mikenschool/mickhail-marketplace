"use client";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { supabase, PUBLIC_COLS, categoryLabel, formatPrice, timeAgo } from "../../supabase";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID_RE = /^[0-9a-f-]{36}$/i;

function MessageSeller({ listing }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    body: `Hi! Is the ${listing.title} still available?`,
  });
  const [errors, setErrors] = useState({});
  const [state, setState] = useState("idle"); // idle | sending | sent | fail
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function send(e) {
    e.preventDefault();
    const x = {};
    if (!form.name.trim()) x.name = "Add your name.";
    if (!EMAIL_RE.test(form.email.trim())) x.email = "Enter your email so the seller can reply.";
    if (form.body.trim().length < 2) x.body = "Write a message.";
    setErrors(x);
    if (Object.keys(x).length) return;
    setState("sending");
    const { error } = await supabase.from("messages").insert({
      listing_id: listing.id,
      buyer_name: form.name.trim(),
      buyer_email: form.email.trim().toLowerCase(),
      body: form.body.trim(),
    });
    setState(error ? "fail" : "sent");
  }

  if (state === "sent") {
    return (
      <div className="msg-box sent" role="status">
        <p className="msg-h">Message sent</p>
        <p>The seller will reply to <strong>{form.email.trim()}</strong>.</p>
        <button type="button" className="link" onClick={() => { setState("idle"); setForm((f) => ({ ...f, body: "" })); }}>
          Send another message
        </button>
      </div>
    );
  }

  const field = (k) => ({
    "aria-invalid": errors[k] ? "true" : undefined,
    "aria-describedby": errors[k] ? `m-${k}-err` : undefined,
  });

  return (
    <form className="msg-box" onSubmit={send} noValidate>
      <p className="msg-h">Message seller</p>
      <label htmlFor="m-body" className="sr">Message</label>
      <textarea id="m-body" rows={3} value={form.body} onChange={set("body")} maxLength={1000} {...field("body")} />
      {errors.body && <p className="field-err" id="m-body-err">{errors.body}</p>}
      <div className="msg-row">
        <div>
          <label htmlFor="m-name">Your name</label>
          <input id="m-name" autoComplete="name" value={form.name} onChange={set("name")} maxLength={60} {...field("name")} />
          {errors.name && <p className="field-err" id="m-name-err">{errors.name}</p>}
        </div>
        <div>
          <label htmlFor="m-email">Your email</label>
          <input id="m-email" type="email" autoComplete="email" value={form.email} onChange={set("email")} maxLength={120} {...field("email")} />
          {errors.email && <p className="field-err" id="m-email-err">{errors.email}</p>}
        </div>
      </div>
      {state === "fail" && <p className="notice err" role="alert">Couldn't send. Check your connection and try again.</p>}
      <button className="btn btn-primary btn-lg" disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}

function BuyBox({ item }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (item.sold) {
    return (
      <div className="buy-box sold-box">
        <p className="msg-h">Sold</p>
        <p>Someone already bought this item.</p>
      </div>
    );
  }
  if (!item.buyable) {
    return (
      <p className="buy-note">
        This seller hasn't set up card payments yet. Send them a message below.{" "}
        <Link href="/connect">Are you the seller?</Link>
      </p>
    );
  }

  async function buy() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: item.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error);
      window.location.href = data.url;
    } catch (err) {
      setError(err.message || "Couldn't open checkout. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="buy-box">
      <button type="button" className="btn btn-primary btn-lg" onClick={buy} disabled={busy}>
        {busy ? "Opening secure checkout…" : `Buy now · ${formatPrice(item.price)}`}
      </button>
      {error && <p className="notice err" role="alert">{error}</p>}
      <p className="fine">Secure card payment by Stripe. Test mode: use card 4242 4242 4242 4242.</p>
    </div>
  );
}

function Detail() {
  const { id } = useParams();
  const params = useSearchParams();
  const [item, setItem] = useState(undefined);

  useEffect(() => {
    if (!UUID_RE.test(id)) { setItem(null); return; }
    supabase.from("listings").select(PUBLIC_COLS).eq("id", id).maybeSingle()
      .then(({ data }) => setItem(data ?? null));
  }, [id]);

  useEffect(() => {
    if (item) document.title = `${item.title} · Palengke`;
  }, [item]);

  if (item === undefined) return <main className="wrap"><div className="detail skel-detail" aria-busy="true" /></main>;

  if (item === null) {
    return (
      <main className="wrap narrow">
        <div className="empty">
          <p className="empty-h">This listing isn't here.</p>
          <p><Link href="/">Browse all listings</Link></p>
        </div>
      </main>
    );
  }

  return (
    <main className="wrap">
      <p className="crumb">
        <Link href="/">All listings</Link> <span aria-hidden="true">›</span>{" "}
        <Link href={`/?cat=${item.category}`}>{categoryLabel(item.category)}</Link>
      </p>
      {params.get("new") && (
        <p className="notice ok" role="status">
          Your listing is live.{" "}
          {!item.buyable && <>Want buyers to pay by card? <Link href="/connect">Connect with Stripe</Link>.</>}
        </p>
      )}
      {params.get("canceled") && <p className="notice" role="status">Checkout canceled. You weren't charged.</p>}
      <article className="detail">
        <div className="detail-img">
          <img src={item.image_url} alt={item.title} />
        </div>
        <div className="detail-info">
          <h1 className="detail-title">{item.title}</h1>
          <p className="detail-price">
            {formatPrice(item.price)} {item.sold && <span className="badge sold inline">Sold</span>}
          </p>
          <p className="meta">Listed {timeAgo(item.created_at)} · {categoryLabel(item.category)}</p>
          <BuyBox item={item} />
          <h2 className="h2">Details</h2>
          <p className="desc">{item.description}</p>
          <MessageSeller listing={item} />
        </div>
      </article>
    </main>
  );
}

export default function ListingPage() {
  return (
    <Suspense fallback={<main className="wrap" />}>
      <Detail />
    </Suspense>
  );
}
