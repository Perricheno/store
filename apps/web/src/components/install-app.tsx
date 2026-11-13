"use client";

import { useEffect, useRef, useState } from "react";
import type { Locale } from "../lib/i18n";
import s from "./install-app.module.css";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
const copy = {
  ru: {
    install: "Установить приложение",
    title: "Установить Urbanmag",
    ios: "В Safari нажмите «Поделиться», затем «На экран Домой» и подтвердите добавление.",
    close: "Закрыть",
  },
  kk: {
    install: "Қолданбаны орнату",
    title: "Urbanmag орнату",
    ios: "Safari-де «Бөлісу» түймесін басып, «Басты экранға» тармағын таңдап, қосуды растаңыз.",
    close: "Жабу",
  },
  en: {
    install: "Install app",
    title: "Install Urbanmag",
    ios: "In Safari, tap Share, choose Add to Home Screen, and confirm.",
    close: "Close",
  },
} as const;

export function InstallApp({ locale }: { locale: Locale }) {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [ios, setIos] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const t = copy[locale];
  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator &&
        Boolean(
          (navigator as Navigator & { standalone?: boolean }).standalone,
        ));
    const appleMobile =
      /iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIos(appleMobile && !standalone);
    const offer = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const installed = () => {
      setPrompt(null);
      setIos(false);
    };
    window.addEventListener("beforeinstallprompt", offer);
    window.addEventListener("appinstalled", installed);
    if ("serviceWorker" in navigator && window.isSecureContext)
      void navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => {
      window.removeEventListener("beforeinstallprompt", offer);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);
  if (!prompt && !ios) return null;
  async function install() {
    if (!prompt) {
      dialog.current?.showModal();
      return;
    }
    const current = prompt;
    setPrompt(null);
    try {
      await current.prompt();
      await current.userChoice;
    } catch {
      /* Browser may withdraw the offer. */
    }
  }
  return (
    <>
      <button type="button" className={s.install} onClick={install}>
        {t.install}
      </button>
      <dialog
        ref={dialog}
        className={s.dialog}
        aria-labelledby="install-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
      >
        <div>
          <h2 id="install-title">{t.title}</h2>
          <p>{t.ios}</p>
          <button
            type="button"
            className={s.close}
            onClick={() => dialog.current?.close()}
          >
            {t.close}
          </button>
        </div>
      </dialog>
    </>
  );
}
