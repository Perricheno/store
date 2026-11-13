"use client";

import { useState } from "react";
import { Pause, Play } from "@phosphor-icons/react";
import { localized } from "./shop-client";
import type { Common } from "./shop-types";
import s from "./shop-announcement.module.css";

export function StoreAnnouncement({ locale, settings }: Common) {
  const [paused, setPaused] = useState(false);
  const announcement = settings?.announcement;
  const text = localized(announcement?.text, locale).trim();
  if (!announcement?.enabled || !text) return null;
  const href = announcement.href;
  const safeHref =
    href && /^\/(?!\/)/.test(href) && !/[\\\u0000-\u001f]/.test(href)
      ? href
      : undefined;
  const label = {
    ru: paused ? "Продолжить бегущую строку" : "Остановить бегущую строку",
    kk: paused ? "Жылжымалы жолды жалғастыру" : "Жылжымалы жолды тоқтату",
    en: paused ? "Resume announcement" : "Pause announcement",
  }[locale];
  const track = (
    <span className={s.track} aria-hidden="true">
      {[0, 1].map((group) => (
        <span className={s.group} key={group}>
          {[0, 1, 2].map((copy) => (
            <span key={copy}>
              {text}
              <span className={s.separator}>+</span>
            </span>
          ))}
        </span>
      ))}
    </span>
  );
  return (
    <aside className={`${s.strip} ${paused ? s.paused : ""}`} aria-label={text}>
      {safeHref ? (
        <a className={s.content} href={safeHref} aria-label={text}>
          {track}
        </a>
      ) : (
        <div className={s.content}>{track}</div>
      )}
      <button
        type="button"
        className={s.pause}
        aria-label={label}
        aria-pressed={paused}
        onClick={() => setPaused((value) => !value)}
      >
        {paused ? (
          <Play size={17} weight="bold" aria-hidden="true" />
        ) : (
          <Pause size={17} weight="bold" aria-hidden="true" />
        )}
      </button>
    </aside>
  );
}
