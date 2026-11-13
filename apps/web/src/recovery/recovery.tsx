"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/config";
import { ShopShell } from "@/components/shop-shell";
import s from "@/staff/dashboard.module.css";
const copy = {
  ru: {
    title: "Доступ к аккаунту",
    email: "Почта",
    password: "Новый пароль",
    send: "Отправить письмо",
    save: "Сохранить пароль",
    sent: "Если аккаунт существует, письмо отправлено.",
    done: "Пароль установлен. Теперь можно войти.",
    login: "Войти",
    error:
      "Не удалось выполнить запрос. Проверьте ссылку и попробуйте ещё раз.",
    hint: "Минимум 12 символов",
  },
  kk: {
    title: "Аккаунтқа қолжетімділік",
    email: "Пошта",
    password: "Жаңа құпиясөз",
    send: "Хат жіберу",
    save: "Құпиясөзді сақтау",
    sent: "Аккаунт бар болса, хат жіберілді.",
    done: "Құпиясөз орнатылды. Енді кіруге болады.",
    login: "Кіру",
    error: "Сұрау орындалмады. Сілтемені тексеріп, қайта көріңіз.",
    hint: "Кемінде 12 таңба",
  },
  en: {
    title: "Account access",
    email: "Email",
    password: "New password",
    send: "Send email",
    save: "Save password",
    sent: "If the account exists, an email has been sent.",
    done: "Password set. You can now sign in.",
    login: "Sign in",
    error: "Unable to complete the request. Check your link and try again.",
    hint: "At least 12 characters",
  },
};
export function Recovery({
  locale = "ru",
  claim = false,
  staff = false,
  embedded = false,
}: {
  locale?: Locale;
  claim?: boolean;
  staff?: boolean;
  embedded?: boolean;
}) {
  const t = copy[locale];
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const value = new URLSearchParams(location.search).get("token");
    if (value) {
      setToken(value);
      history.replaceState(null, "", location.pathname);
    }
  }, []);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const action = claim ? "claim" : token ? "reset/confirm" : "reset";
      const r = await fetch(`/api/${staff ? "staff/" : ""}auth/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          token ? { token, newPassword: password } : { email },
        ),
      });
      if (!r.ok) throw new Error();
      setDone(true);
    } catch {
      setError(t.error);
    } finally {
      setBusy(false);
    }
  }
  const FormContainer = staff ? "main" : "section";
  const form = (
    <FormContainer className={s.center}>
      <p className={s.eyebrow}>Urbanmag</p>
      <h1>{t.title}</h1>
      {done ? (
        <>
          <p className={s.notice}>{token ? t.done : t.sent}</p>
          <Link
            className={`${s.button} ${s.primary}`}
            href={staff ? "/staff" : `/${locale}/account`}
          >
            {t.login}
          </Link>
        </>
      ) : (
        <form onSubmit={submit} className={s.form}>
          {token ? (
            <label className={s.field}>
              {t.password}
              <input
                className={s.input}
                type="password"
                minLength={12}
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <small>{t.hint}</small>
            </label>
          ) : (
            <label className={s.field}>
              {t.email}
              <input
                className={s.input}
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
          )}
          {error && (
            <p className={s.error} role="alert">
              {error}
            </p>
          )}
          <button className={`${s.button} ${s.primary}`} disabled={busy}>
            {token ? t.save : t.send}
          </button>
        </form>
      )}
    </FormContainer>
  );
  return staff || embedded ? form : <ShopShell locale={locale}>{form}</ShopShell>;
}
