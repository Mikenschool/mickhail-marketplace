// One-time setup for Test 4. Run:  node setup-stripe.mjs
// 1. Reads the Stripe sandbox key from .env.local (paste it there first).
// 2. Creates the Connect webhook endpoint for the live site and saves its secret in .env.local.
// 3. Saves the env vars in the Vercel project and redeploys.
// It never prints any key.
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Stripe from "stripe";

process.chdir(dirname(fileURLToPath(import.meta.url)));

const SITE = "https://mickhail-marketplace.vercel.app";
const SCOPE = "mikethegamer477-6241s-projects";
const PROJECT = "mickhail-marketplace";
const ENV_FILE = ".env.local";

const readEnv = () =>
  Object.fromEntries(
    readFileSync(ENV_FILE, "utf8")
      .split(/\r?\n/)
      .filter((l) => /^[A-Z_]+=/.test(l))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])
  );

function setEnvLine(name, value) {
  let text = readFileSync(ENV_FILE, "utf8");
  const re = new RegExp(`^${name}=.*$`, "m");
  text = re.test(text) ? text.replace(re, `${name}=${value}`) : `${text.trimEnd()}\n${name}=${value}\n`;
  writeFileSync(ENV_FILE, text);
}

let env = readEnv();
const key = env.STRIPE_SECRET_KEY || "";
if (!key.startsWith("sk_test_") && !key.startsWith("rk_test_")) {
  console.error("STRIPE_SECRET_KEY in .env.local is missing or is not a sandbox (test) key. Paste Greg's sandbox secret key and run again.");
  process.exit(1);
}

const stripe = new Stripe(key);
const url = `${SITE}/api/stripe/webhook`;

// Only touch endpoints that point at THIS app (the sandbox is shared).
console.log("1/3 Creating the Stripe webhook…");
const { data: existing } = await stripe.webhookEndpoints.list({ limit: 100 });
for (const ep of existing.filter((e) => e.url === url)) {
  await stripe.webhookEndpoints.del(ep.id);
}
let webhookOk = false;
try {
  const endpoint = await stripe.webhookEndpoints.create({
    url,
    connect: true,
    enabled_events: ["checkout.session.completed", "account.updated"],
    description: "Palengke marketplace (Mickhail Felismino, SUpost Test 4)",
  });
  setEnvLine("STRIPE_WEBHOOK_SECRET", endpoint.secret);
  webhookOk = true;
  console.log("    done, secret saved in .env.local");
} catch (err) {
  if (!/maximum of \d+ test webhook endpoints/i.test(err.message)) throw err;
  console.log("    The shared sandbox is full (16 webhooks, made by other candidates). Skipping the webhook for now.");
  console.log("    Orders are still saved and marked Sold by the success page. Run this script again later to add the webhook.");
}
env = readEnv();

console.log("2/3 Saving settings in Vercel…");
const names = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SERVER_TOKEN",
  "STRIPE_SECRET_KEY",
  ...(webhookOk || env.STRIPE_WEBHOOK_SECRET ? ["STRIPE_WEBHOOK_SECRET"] : []),
];
for (const name of names) {
  if (!env[name]) {
    console.error(`    ${name} is empty in .env.local. Stopping.`);
    process.exit(1);
  }
  try {
    execSync(`vercel env rm ${name} production -y --scope ${SCOPE}`, { stdio: "ignore" });
  } catch {}
  execSync(`vercel env add ${name} production --scope ${SCOPE}`, { input: env[name], stdio: ["pipe", "ignore", "inherit"] });
  console.log(`    ${name} saved`);
}

console.log("3/3 Redeploying the live site (about 1 minute)…");
execSync(`vercel --prod --yes --scope ${SCOPE} --name ${PROJECT}`, { stdio: ["ignore", "ignore", "inherit"] });
console.log(`All set. Open ${SITE}/connect to connect a seller.`);
