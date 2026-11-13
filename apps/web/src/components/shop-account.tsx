"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Check, User, SignOut } from "@phosphor-icons/react";
import { dictionary } from "../lib/i18n";
import s from "./shop.module.css";
import { type Common, type Order } from "./shop-types";
import { request, post } from "./shop-client";
import { BuyerHistory } from "./shop-buyer-history";
import { BuyerHelp } from "./shop-buyer-help";
import { BuyerOrders } from "./shop-buyer-orders";
import { buyerCopy } from "./buyer-copy";
import bs from "./shop-buyer.module.css";
import { PageTitle, ErrorNotice } from "./shop-ui";

export type AccountUser = {
  id: string;
  email: string;
  mustChangePassword?: boolean;
  requiresPasswordChange?: boolean;
  temporaryPassword?: boolean;
};

export function AccountView({ locale, settings, initialCart }: Common) {
  const t = dictionary(locale), copy = buyerCopy[locale];
  const [user, setUser] = useState<AccountUser | null>(null),
    [orders, setOrders] = useState<Order[]>([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [currentPassword, setCurrentPassword] = useState(""),
    [newPassword, setNewPassword] = useState("");
  const load = useCallback(async () => {
    try {
      const data = await request<{ user: AccountUser | null }>("/api/auth/me");
      setUser(data.user);
      if (!data.user || data.user.mustChangePassword) setOrders([]);
      if (data.user && !data.user.mustChangePassword) {
        const result = await request<Order[] | { orders: Order[] }>(
          "/api/account/orders",
        );
        setOrders(Array.isArray(result) ? result : result.orders);
      }
    } catch {
      setError(t.error);
      throw new Error("Account refresh failed");
    } finally {
      setLoading(false);
    }
  }, [t.error]);
  useEffect(() => {
    void load().catch(() => {});
  }, [load]);
  async function login(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await post("/api/auth/login", { email, password });
      setPassword("");
      await load();
    } catch {
      setError(t.authError);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    try {
      await post("/api/auth/logout", {});
      setUser(null);
      setOrders([]);
      setNotice("");
    } catch {
      setError(t.error);
    } finally {
      setBusy(false);
    }
  }
  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await post(
        "/api/auth/password",
        { currentPassword, newPassword },
        "PATCH",
      );
      setNotice(t.passwordSaved);
      setCurrentPassword("");
      setNewPassword("");
      await load();
    } catch {
      setError(t.error);
    } finally {
      setBusy(false);
    }
  }
  const mustChange =
    user &&
    (user.mustChangePassword ||
      user.requiresPasswordChange ||
      user.temporaryPassword);
  return (
    <>
      <section className={s.innerPage}>
        <PageTitle title={t.account} locale={locale} />
        {loading ? (
          <div className={s.loading}>{t.loading}</div>
        ) : !user ? (
          <div className={s.loginLayout}>
            <div className={s.loginIntro}>
              <span className={s.accountLargeIcon}>
                <User size={58} weight="bold" />
              </span>
              <h2>{t.loginHint}</h2>
              <p>{t.guestHint}</p>
            </div>
            <form className={s.loginForm} onSubmit={login}>
              <h2>{t.login}</h2>
              <Link
                prefetch={false}
                href={`/${locale}/reset`}
                className={s.textButton}
              >
                {locale === "ru"
                  ? "Забыли пароль?"
                  : locale === "kk"
                    ? "Құпиясөзді ұмыттыңыз ба?"
                    : "Forgot password?"}
              </Link>
              <label className={s.field}>
                {t.email}
                <input
                  aria-label={t.email}
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className={s.field}>
                {t.password}
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              {error && <ErrorNotice text={error} />}
              <button className={s.primaryButton} disabled={busy}>
                {busy ? t.loading : t.login}
                <ArrowRight size={20} />
              </button>
            </form>
          </div>
        ) : (
          <div className={s.accountLayout}>
            <aside className={s.accountSidebar}>
              <span className={s.accountAvatar}>
                <User size={35} weight="bold" />
              </span>
              <strong>{user.email}</strong>
              <button className={s.textButton} onClick={logout} disabled={busy}>
                {t.logout}
                <SignOut size={19} />
              </button>
            </aside>
            <div className={s.accountContent}>
              {error && <ErrorNotice text={error} />}
              {!mustChange && <>
                <nav className={bs.accountNav} aria-label={copy.profile}>
                  <a href="#purchases">{copy.purchases}</a><a href="#notifications">{copy.notifications}</a><a href="#check-order">{copy.checkOrder}</a>
                  <Link prefetch={false} href={`/${locale}/account/wallet`}>{locale === "ru" ? "Баланс" : locale === "kk" ? "Баланс" : "Balance"}</Link>
                  <a href="#history">{copy.viewed}</a><a href="#help">{copy.help}</a>
                </nav>
                <BuyerOrders userId={user.id} orders={orders} locale={locale} busy={busy} refresh={async () => { setBusy(true); setError(""); try { await load(); } finally { setBusy(false); } }} />
              </>}
              <section className={s.accountSection}>
                <h2>{t.changePassword}</h2>
                {mustChange && <p className={s.note}>{t.temporaryPassword}</p>}
                <form className={s.passwordForm} onSubmit={changePassword}>
                  <label className={s.field}>
                    {t.currentPassword}
                    <input
                      type="password"
                      autoComplete="current-password"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                    />
                  </label>
                  <label className={s.field}>
                    {t.newPassword}
                    <input
                      type="password"
                      autoComplete="new-password"
                      minLength={12}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <small>{t.passwordLength}</small>
                  </label>
                  {notice && (
                    <p className={s.saved} role="status">
                      <Check size={18} />
                      {notice}
                    </p>
                  )}
                  <button className={s.primaryButton} disabled={busy}>
                    {busy ? t.loading : t.save}
                    <ArrowRight size={20} />
                  </button>
                </form>
              </section>
            </div>
          </div>
        )}
        {!loading && !mustChange && <div id="history"><BuyerHistory locale={locale} /></div>}
        {!loading && <BuyerHelp locale={locale} settings={settings} />}
      </section>
    </>
  );
}
