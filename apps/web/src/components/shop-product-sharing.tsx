"use client";
import { useEffect, useState } from "react";
import { ShareNetwork } from "@phosphor-icons/react";
import type { Product } from "@urbanmag/core";
import type { Locale } from "../lib/i18n";
import { buyerCopy } from "./buyer-copy";
import { recordDeviceView } from "./shop-buyer-history";
import s from "./shop-buyer.module.css";

export function ProductSharing({ product, locale, variantId }: { product: Product; locale: Locale; variantId: string }) {
  const copy = buyerCopy[locale];
  const [notice, setNotice] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { recordDeviceView(product); }, [product.slug, product.category]);
  async function share() {
    if (busy) return;
    setBusy(true); setNotice(""); setLink("");
    const url = `${window.location.origin}/${locale}/p/${product.slug}`;
    try {
      if (navigator.share) {
        try { await navigator.share({ title: product.names[locale] || product.names.ru, url }); return; }
        catch (error) { if (error instanceof Error && error.name === "AbortError") return; }
      }
      try { await navigator.clipboard.writeText(url); setNotice(copy.copied); }
      catch { setLink(url); setNotice(copy.shareError); }
    } finally { setBusy(false); }
  }
  const selected = product.sizes.find((variant) => variant.id === variantId);
  return <div className={s.productTools}>
    <button type="button" onClick={share} disabled={busy}><ShareNetwork size={20} />{copy.share}</button>
    {notice && <p role="status">{notice}</p>}
    {link && <label>{copy.productLink}<input readOnly value={link} onFocus={(event) => event.target.select()} /></label>}
    <dl className={s.codes}><div><dt>{copy.productCode}</dt><dd>{product.id}</dd></div>
      {selected && <div><dt>{copy.variantCode}</dt><dd>{selected.id}</dd></div>}
    </dl>
  </div>;
}
