"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase, BUCKET, MAX_PHOTO_MB, CATEGORIES } from "../supabase";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function Sell() {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [form, setForm] = useState({ title: "", description: "", price: "", email: "", category: "" });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function pickPhoto(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setErrors((x) => ({ ...x, photo: "Choose an image file (JPG, PNG, WebP or GIF)." }));
      return;
    }
    if (f.size > MAX_PHOTO_MB * 1024 * 1024) {
      setErrors((x) => ({ ...x, photo: `That photo is over ${MAX_PHOTO_MB} MB. Pick a smaller one.` }));
      return;
    }
    setErrors((x) => ({ ...x, photo: undefined }));
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function validate() {
    const e = {};
    if (!file) e.photo = "Add a photo of the item.";
    if (form.title.trim().length < 3) e.title = "Give it a title (at least 3 characters).";
    if (form.description.trim().length < 10) e.description = "Describe it in a sentence or two.";
    const p = Number(form.price);
    if (form.price === "" || Number.isNaN(p) || p < 0) e.price = "Enter a price (0 for free).";
    else if (p > 10000000) e.price = "That price is too high.";
    if (!EMAIL_RE.test(form.email.trim())) e.email = "Enter an email so buyers can reach you.";
    if (!form.category) e.category = "Pick a category.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(e) {
    e.preventDefault();
    setFail("");
    if (!validate()) {
      const first = document.querySelector("[aria-invalid='true']");
      first?.focus();
      return;
    }
    setBusy(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `${crypto.randomUUID()}.${ext || "jpg"}`;
      const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
      if (up.error) throw up.error;
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);

      const { data, error } = await supabase
        .from("listings")
        .insert({
          title: form.title.trim(),
          description: form.description.trim(),
          price: Math.round(Number(form.price) * 100) / 100,
          seller_email: form.email.trim().toLowerCase(),
          category: form.category,
          image_url: pub.publicUrl,
        })
        .select("id")
        .single();
      if (error) throw error;
      router.push(`/listing/${data.id}?new=1`);
    } catch (err) {
      console.error(err);
      setFail("Couldn't post your listing. Check your connection and try again.");
      setBusy(false);
    }
  }

  const field = (k) => ({
    "aria-invalid": errors[k] ? "true" : undefined,
    "aria-describedby": errors[k] ? `${k}-err` : undefined,
  });
  const Err = ({ k }) => (errors[k] ? <p className="field-err" id={`${k}-err`}>{errors[k]}</p> : null);

  return (
    <main className="wrap narrow">
      <p className="crumb"><Link href="/">← All listings</Link></p>
      <h1 className="h1">Sell an item</h1>
      <p className="lede">Listings are public. Your email stays hidden; buyers message you through the site.</p>

      <form className="sell" onSubmit={submit} noValidate>
        <div className="photo-pick">
          <label className={`drop${preview ? " has" : ""}`} htmlFor="photo">
            {preview ? (
              <img src={preview} alt="Selected photo" />
            ) : (
              <span>
                <strong>Add a photo</strong>
                <small>JPG, PNG or WebP, up to {MAX_PHOTO_MB} MB</small>
              </span>
            )}
          </label>
          <input id="photo" type="file" accept="image/*" className="sr" onChange={pickPhoto} {...field("photo")} />
          {preview && (
            <button type="button" className="link" onClick={() => document.getElementById("photo").click()}>
              Change photo
            </button>
          )}
          <Err k="photo" />
        </div>

        <div className="fields">
          <label htmlFor="title">Title</label>
          <input id="title" value={form.title} onChange={set("title")} maxLength={80} placeholder="e.g. TI-84 calculator, barely used" {...field("title")} />
          <Err k="title" />

          <label htmlFor="price">Price (₱)</label>
          <input id="price" type="number" inputMode="decimal" min="0" step="0.01" value={form.price} onChange={set("price")} placeholder="0 for free" {...field("price")} />
          <Err k="price" />

          <label htmlFor="category">Category</label>
          <select id="category" value={form.category} onChange={set("category")} {...field("category")}>
            <option value="">Choose one</option>
            {CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
          </select>
          <Err k="category" />

          <label htmlFor="description">Description</label>
          <textarea id="description" rows={5} value={form.description} onChange={set("description")} maxLength={2000} placeholder="Condition, size, where to meet up…" {...field("description")} />
          <Err k="description" />

          <label htmlFor="email">Your email</label>
          <input id="email" type="email" autoComplete="email" value={form.email} onChange={set("email")} maxLength={120} placeholder="you@example.com" {...field("email")} />
          <Err k="email" />

          {fail && <p className="notice err" role="alert">{fail}</p>}

          <button className="btn btn-primary btn-lg" disabled={busy}>
            {busy ? "Posting…" : "Post listing"}
          </button>
        </div>
      </form>
    </main>
  );
}
