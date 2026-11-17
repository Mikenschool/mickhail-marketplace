"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function ConnectForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function go(e) {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      setError("Enter the same email you used on your listings.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error);
      window.location.href = data.url;
    } catch (err) {
      setError(err.message || "Couldn't reach Stripe. Try again.");
      setBusy(false);
    }
  }

  return (
    <main className="wrap narrow">
      <p className="crumb"><Link href="/">← All listings</Link></p>
      <h1 className="h1">Get paid with Stripe</h1>
      <p className="lede">
        Connect a Stripe account once, and every listing you posted with this email gets a <strong>Buy now</strong> button.
        Buyers pay by card, the money goes to your Stripe account, and Palengke keeps a 10% fee.
      </p>
      {params.get("retry") && (
        <p className="notice err" role="status">Your Stripe link expired. Press Connect again to pick up where you left off.</p>
      )}

      <form className="connect-box" onSubmit={go} noValidate>
        <label htmlFor="c-email">Your seller email</label>
        <input
          id="c-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? "c-err" : undefined}
          placeholder="the email on your listings"
        />
        {error && <p className="field-err" id="c-err">{error}</p>}
        <button className="btn btn-stripe btn-lg" disabled={busy}>
          {busy ? "Opening Stripe…" : "Connect with Stripe"}
        </button>
        <p className="fine">
          You'll finish on Stripe's own secure page. This demo runs in Stripe's sandbox, so no real money moves.
        </p>
      </form>
    </main>
  );
}

export default function ConnectPage() {
  return (
    <Suspense fallback={<main className="wrap narrow" />}>
      <ConnectForm />
    </Suspense>
  );
}
