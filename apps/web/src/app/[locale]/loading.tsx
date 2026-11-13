import { headers } from "next/headers";
import { dictionary } from "@/lib/i18n";
import { isLocale } from "@/lib/config";
import { TShirt } from "@phosphor-icons/react/ssr";
import s from "@/components/shop.module.css";

export default async function Loading() {
  const language = (await headers()).get("x-urbanmag-locale") || "ru";
  const t = dictionary(isLocale(language) ? language : "ru");
  return (
    <div className={s.shop} aria-busy="true" aria-label={t.loading}>
      <header className={s.header}>
        <div className={s.headerInner}>
          <div className={s.logo}>
            <span>
              URBAN<span className={s.logoSlash}>/</span>
            </span>
            <span>
              MAG<span className={s.logoDot}>●</span>
            </span>
          </div>
        </div>
      </header>
      <main className={s.main}>
        <section className={s.catalog}>
          <div className={s.catalogTop}>
            <div>
              <div className={s.catalogTitle}>
                …
              </div>
            </div>
          </div>
          <div className={s.genderTabs} aria-hidden="true">
            <button disabled>{t.all}</button>
            <button disabled>{t.men}</button>
            <button disabled>{t.women}</button>
          </div>
          <div className={s.categoryRow} aria-hidden="true">
            <div className={s.categoryScroll}>
              {[t.all, t.tShirts, t.hoodies, t.outerwear].map((label) => (
                <button disabled key={label}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className={s.catalogUtilities} aria-hidden="true">
            <div className={s.catalogSearch} style={{ minHeight: 44 }} />
            <span className={s.count}>…</span>
            <div className={s.sort}>{t.newest}</div>
          </div>
          <div className={s.productGrid}>
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i}>
                <div className={s.cardImage}>
                  <div
                    className={s.productMedia}
                    style={{ display: "grid", placeItems: "center" }}
                  >
                    <TShirt
                      className="skeleton-icon"
                      size="48%"
                      weight="bold"
                      aria-hidden="true"
                    />
                  </div>
                </div>
                <div style={{ height: 76 }} />
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
