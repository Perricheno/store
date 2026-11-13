"use client";
import { useState, type FormEvent } from "react";
import type { Settings } from "@urbanmag/core";
import s from "./dashboard.module.css";

const copy = {
  ru: {
    marketing: "Маркетинг",
    readOnly: "Просмотр: изменения доступны владельцу.",
    contentPages: "Страницы",
    contentPage: "Страница",
    pageAbout: "О магазине",
    pageDelivery: "Доставка и оплата",
    pageReturns: "Возврат",
    pagePrivacy: "Политика конфиденциальности",
    pageTerms: "Условия использования",
    announcement: "Объявление",
    banner: "Баннер",
    showPromotion: "Показывать на витрине",
    promotionHint: "Текст на всех трёх языках обязателен при включении.",
    promotionLink: "Ссылка внутри магазина (необязательно)",
    bannerImage: "Изображение баннера",
    removeImage: "Удалить изображение",
    save: "Сохранить",
    saved: "Маркетинг сохранён",
    failed: "Не удалось сохранить изменения",
  },
  kk: {
    marketing: "Маркетинг",
    readOnly: "Көру режимі: өзгерістерді тек иесі енгізе алады.",
    contentPages: "Беттер",
    contentPage: "Бет",
    pageAbout: "Дүкен туралы",
    pageDelivery: "Жеткізу және төлем",
    pageReturns: "Қайтару",
    pagePrivacy: "Құпиялық саясаты",
    pageTerms: "Пайдалану шарттары",
    announcement: "Хабарландыру",
    banner: "Баннер",
    showPromotion: "Дүкенде көрсету",
    promotionHint: "Қосылғанда үш тілдегі мәтін міндетті.",
    promotionLink: "Дүкен ішіндегі сілтеме (міндетті емес)",
    bannerImage: "Баннер суреті",
    removeImage: "Суретті жою",
    save: "Сақтау",
    saved: "Маркетинг сақталды",
    failed: "Өзгерістерді сақтау мүмкін болмады",
  },
  en: {
    marketing: "Marketing",
    readOnly: "Read only: changes are available to the owner.",
    contentPages: "Pages",
    contentPage: "Page",
    pageAbout: "About",
    pageDelivery: "Delivery and payment",
    pageReturns: "Returns",
    pagePrivacy: "Privacy policy",
    pageTerms: "Terms of use",
    announcement: "Announcement",
    banner: "Banner",
    showPromotion: "Show in store",
    promotionHint: "Text in all three languages is required when enabled.",
    promotionLink: "Store link (optional)",
    bannerImage: "Banner image",
    removeImage: "Remove image",
    save: "Save",
    saved: "Marketing saved",
    failed: "Could not save changes",
  },
};
export function StaffMarketing({
  lang,
  settings,
  canEdit,
  onSaved,
}: {
  lang: keyof typeof copy;
  settings: Settings;
  canEdit: boolean;
  onSaved: (settings: Settings) => void;
}) {
  const t = copy[lang];
  const [contentPage, setContentPage] = useState<
    "about" | "delivery" | "returns" | "privacy" | "terms"
  >("about");
  const [contentDraft, setContentDraft] = useState<Settings["contentPages"]>();
  const [bannerImage, setBannerImage] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch {
      setError(t.failed);
    } finally {
      setBusy(false);
    }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) return;
    const form = new FormData(event.currentTarget);
    await run(async () => {
      const response = await fetch("/api/staff/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...settings,
          contentPages: contentDraft ?? settings.contentPages,
          announcement: {
            enabled: form.get("announcementEnabled") === "on",
            text: Object.fromEntries(
              (["ru", "kk", "en"] as const).map((locale) => [
                locale,
                String(form.get(`announcement_${locale}`) || ""),
              ]),
            ),
            href: String(form.get("announcementHref") || ""),
          },
          banner: {
            enabled: form.get("bannerEnabled") === "on",
            title: Object.fromEntries(
              (["ru", "kk", "en"] as const).map((locale) => [
                locale,
                String(form.get(`banner_${locale}`) || ""),
              ]),
            ),
            href: String(form.get("bannerHref") || ""),
            imageUrl: (bannerImage ?? settings.banner?.imageUrl) || undefined,
          },
        }),
      });
      if (!response.ok) throw new Error();
      onSaved(await response.json());
      setNotice(t.saved);
    });
  }
  return (
    <section className={s.card}>
      <h2>{t.marketing}</h2>
      {!canEdit && <p className={s.notice}>{t.readOnly}</p>}
      <form className={s.form} onSubmit={save}>
        {(["announcement", "banner"] as const).map((kind) => (
          <fieldset
            className={s.promotionFields}
            key={kind}
            disabled={!canEdit || busy}
          >
            <legend>{t[kind]}</legend>
            <label className={s.checks}>
              <input
                type="checkbox"
                name={`${kind}Enabled`}
                defaultChecked={settings[kind]?.enabled ?? false}
              />
              {t.showPromotion}
            </label>
            <p className={s.muted}>{t.promotionHint}</p>
            {(["ru", "kk", "en"] as const).map((language) => (
              <label className={s.field} key={language}>
                {language.toUpperCase()}
                <input
                  className={s.input}
                  name={`${kind}_${language}`}
                  maxLength={300}
                  defaultValue={
                    kind === "announcement"
                      ? settings.announcement?.text[language]
                      : settings.banner?.title[language]
                  }
                />
              </label>
            ))}
            <label className={s.field}>
              {t.promotionLink}
              <input
                className={s.input}
                name={`${kind}Href`}
                maxLength={500}
                placeholder="/ru"
                defaultValue={settings[kind]?.href}
              />
            </label>
            {kind === "banner" && (
              <>
                <label className={s.field}>
                  {t.bannerImage}
                  <input
                    className={s.input}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      await run(async () => {
                        const form = new FormData();
                        form.set("file", file);
                        const response = await fetch("/api/staff/uploads", {
                          method: "POST",
                          body: form,
                        });
                        const data = await response.json();
                        if (!response.ok) throw new Error(data.error);
                        setBannerImage(data.url);
                      });
                      event.target.value = "";
                    }}
                  />
                </label>
                {(bannerImage ?? settings.banner?.imageUrl) && (
                  <div className={s.bannerPreview}>
                    <img
                      src={bannerImage ?? settings.banner?.imageUrl}
                      alt=""
                    />
                    <button
                      type="button"
                      className={s.button}
                      onClick={() => {
                        setBannerImage("");
                      }}
                    >
                      {t.removeImage}
                    </button>
                  </div>
                )}
              </>
            )}
          </fieldset>
        ))}
        <details className={s.contentEditor}>
          <summary>{t.contentPages}</summary>
          <label className={s.field}>
            {t.contentPage}
            <select
              className={s.select}
              value={contentPage}
              onChange={(event) =>
                setContentPage(event.target.value as typeof contentPage)
              }
            >
              {(
                ["about", "delivery", "returns", "privacy", "terms"] as const
              ).map((key, index) => (
                <option value={key} key={key}>
                  {
                    [
                      t.pageAbout,
                      t.pageDelivery,
                      t.pageReturns,
                      t.pagePrivacy,
                      t.pageTerms,
                    ][index]
                  }
                </option>
              ))}
            </select>
          </label>
          {(["ru", "kk", "en"] as const).map((language) => (
            <label className={s.field} key={language}>
              {language.toUpperCase()}
              <textarea
                className={s.input}
                name={`content_${contentPage}_${language}`}
                rows={6}
                maxLength={20000}
                disabled={!canEdit || busy}
                value={
                  (contentDraft ?? settings.contentPages)?.[contentPage]?.[
                    language
                  ] ?? ""
                }
                onChange={(event) => {
                  const value = event.target.value;
                  setContentDraft((current) => {
                    const pages = current ?? settings.contentPages ?? {};
                    return {
                      ...pages,
                      [contentPage]: {
                        ru: "",
                        kk: "",
                        en: "",
                        ...pages[contentPage],
                        [language]: value,
                      },
                    };
                  });
                }}
              />
            </label>
          ))}
        </details>
        {error && (
          <p className={s.error} role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className={s.notice} role="status">
            {notice}
          </p>
        )}
        {canEdit && (
          <button className={`${s.button} ${s.primary}`} disabled={busy}>
            {t.save}
          </button>
        )}
      </form>
    </section>
  );
}
