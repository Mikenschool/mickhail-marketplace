import Link from "next/link";
import { stripe, rpc, paymentsReady } from "../../lib/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Stripe connected · Palengke" };

export default async function ConnectReturn({ searchParams }) {
  const { account } = await searchParams;
  let state = "error";
  let email = "";

  if (paymentsReady() && typeof account === "string" && /^acct_[A-Za-z0-9]+$/.test(account)) {
    try {
      const a = await stripe.accounts.retrieve(account);
      const ready = Boolean(a.charges_enabled && a.details_submitted);
      // Only updates sellers we created; returns false for anyone else's account.
      const known = await rpc("set_account_status", { p_account: account, p_onboarded: ready });
      email = a.email ?? "";
      state = !known ? "error" : ready ? "ready" : a.details_submitted ? "pending" : "unfinished";
    } catch (err) {
      console.error("connect return", err);
    }
  }

  return (
    <main className="wrap narrow">
      <div className={`result ${state === "ready" ? "ok" : ""}`}>
        {state === "ready" && (
          <>
            <p className="result-icon" aria-hidden="true">✓</p>
            <h1 className="h1">You're ready to get paid</h1>
            <p>Your Stripe account is connected. Every listing posted with <strong>{email}</strong> now has a Buy now button.</p>
            <div className="result-actions">
              <Link className="btn btn-primary" href="/">See your listings</Link>
              <Link className="btn btn-ghost" href="/sell">Sell another item</Link>
            </div>
          </>
        )}
        {state === "pending" && (
          <>
            <h1 className="h1">Almost there</h1>
            <p>Stripe is still checking your details. Buy now buttons turn on by themselves once Stripe approves the account.</p>
            <div className="result-actions"><Link className="btn btn-primary" href="/">Back to listings</Link></div>
          </>
        )}
        {state === "unfinished" && (
          <>
            <h1 className="h1">Onboarding isn't finished</h1>
            <p>Stripe still needs a few details before you can take payments.</p>
            <div className="result-actions">
              <Link className="btn btn-primary" href={`/connect?email=${encodeURIComponent(email)}`}>Continue with Stripe</Link>
            </div>
          </>
        )}
        {state === "error" && (
          <>
            <h1 className="h1">We couldn't check your Stripe account</h1>
            <p>Please try connecting again.</p>
            <div className="result-actions"><Link className="btn btn-primary" href="/connect">Connect with Stripe</Link></div>
          </>
        )}
      </div>
    </main>
  );
}
