"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type { Wallet, WalletTopup } from "@urbanmag/core";
import { dictionary, money } from "../lib/i18n";
import { type Common } from "./shop-types";
import { request } from "./shop-client";
import { ErrorNotice, PageTitle } from "./shop-ui";
import { walletCopy, walletError } from "./wallet-copy";
import s from "./shop.module.css";
import w from "./shop-wallet.module.css";

type AuthState = "loading" | "guest" | "password" | "ready" | "error";
type Attempt = {
  key: string;
  signature: string;
  amount: string;
  phone: string;
};
export function WalletView({ locale, settings, initialCart }: Common) {
  const t = dictionary(locale),
    copy = walletCopy(locale);
  const [state, setState] = useState<AuthState>("loading");
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<WalletTopup | null>(null);
  const controller = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  const attempt = useRef<Attempt | null>(null);
  const storageKey = useRef("");
  const loadSequence = useRef(0);
  const clearAttempt = () => {
    attempt.current = null;
    try {
      if (storageKey.current) sessionStorage.removeItem(storageKey.current);
    } catch {}
  };
  const load = useCallback(
    async (signal: AbortSignal) => {
      const sequence = ++loadSequence.current;
      try {
        const auth = await request<{
          user: { id: string; mustChangePassword?: boolean } | null;
        }>("/api/auth/me", { signal });
        if (signal.aborted || sequence !== loadSequence.current) return;
        if (!auth.user || auth.user.mustChangePassword) {
          setWallet(null);
          setState(auth.user ? "password" : "guest");
          return;
        }
        const result = await request<Wallet>("/api/wallet", { signal });
        if (signal.aborted || sequence !== loadSequence.current) return;
        const key = `urbanmag-wallet-attempt:${auth.user.id}:${result.environment}`;
        if (storageKey.current !== key) {
          if (storageKey.current) {
            setSelected(null);
            setAmount("");
            setPhone("");
          }
          storageKey.current = key;
          try {
            const stored = JSON.parse(
              sessionStorage.getItem(key) || "null",
            ) as Attempt | null;
            if (
              stored &&
              typeof stored.key === "string" &&
              typeof stored.signature === "string" &&
              typeof stored.amount === "string" &&
              typeof stored.phone === "string"
            ) {
              attempt.current = stored;
              setAmount(stored.amount);
              setPhone(stored.phone);
            } else attempt.current = null;
          } catch {
            attempt.current = null;
          }
        }
        setWallet(result);
        setState("ready");
        setError("");
        setSelected((previous) =>
          previous
            ? result.topups.find((topup) => topup.id === previous.id) ||
              previous
            : null,
        );
      } catch {
        if (!signal.aborted && sequence === loadSequence.current) {
          setWallet(null);
          setState("error");
          setError(copy.error);
        }
      }
    },
    [copy.error],
  );
  useEffect(() => {
    const abort = new AbortController();
    controller.current = abort;
    void load(abort.signal);
    return () => abort.abort();
  }, [load]);
  useEffect(() => {
    if (
      state !== "ready" ||
      !wallet?.topups.some((topup) => topup.status === "pending")
    )
      return;
    const timer = setTimeout(() => {
      if (controller.current && !inFlight.current)
        void load(controller.current.signal);
    }, 5000);
    return () => clearTimeout(timer);
  }, [wallet, state, load]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (
      inFlight.current ||
      !wallet ||
      wallet.frozen ||
      !wallet.topupAvailable ||
      selected?.status === "pending"
    )
      return;
    inFlight.current = true;
    loadSequence.current++;
    setBusy(true);
    setError("");
    setNotice("");
    const signature = JSON.stringify({
      amount: Number(amount),
      phone: phone.trim(),
      environment: wallet.environment,
    });
    if (attempt.current?.signature !== signature)
      attempt.current = { key: crypto.randomUUID(), signature, amount, phone };
    try {
      if (storageKey.current)
        sessionStorage.setItem(
          storageKey.current,
          JSON.stringify(attempt.current),
        );
    } catch {}
    try {
      const topup = await request<WalletTopup>("/api/wallet/topups", {
        method: "POST",
        body: JSON.stringify({
          amount: Number(amount),
          phone,
          idempotencyKey: attempt.current.key,
        }),
        signal: controller.current?.signal,
      });
      if (controller.current?.signal.aborted) return;
      setSelected(topup);
      clearAttempt();
      setNotice(
        topup.environment === "mock"
          ? copy.mockCreated
          : topup.environment === "sandbox"
            ? copy.sandboxCreated
            : copy.created,
      );
      if (controller.current) await load(controller.current.signal);
    } catch (cause) {
      if (controller.current?.signal.aborted) return;
      const code = (cause as { code?: string }).code;
      setError(code ? walletError(code, locale) : copy.ambiguous);
    } finally {
      inFlight.current = false;
      if (!controller.current?.signal.aborted) setBusy(false);
    }
  }
  async function simulate(topup: WalletTopup) {
    if (
      inFlight.current ||
      !topup.simulationAllowed ||
      topup.status !== "pending"
    )
      return;
    inFlight.current = true;
    loadSequence.current++;
    setBusy(true);
    setError("");
    try {
      await request(`/api/wallet/topups/${topup.id}/simulate`, {
        method: "POST",
        body: "{}",
        signal: controller.current?.signal,
      });
      if (controller.current) await load(controller.current.signal);
    } catch (cause) {
      if (!controller.current?.signal.aborted)
        setError(walletError((cause as { code?: string }).code, locale));
    } finally {
      inFlight.current = false;
      if (!controller.current?.signal.aborted) setBusy(false);
    }
  }
  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(
      locale === "kk" ? "kk-KZ" : locale === "ru" ? "ru-KZ" : "en-GB",
      { dateStyle: "medium", timeStyle: "short" },
    ).format(new Date(value));
  return (
    <>
      <section className={s.innerPage}>
        <PageTitle title={copy.title} locale={locale} />
        <div className={w.links}>
          <Link prefetch={false} href={`/${locale}/account`}>
            {copy.account}
          </Link>
          <Link prefetch={false} href={`/${locale}/checkout`}>
            {copy.backCheckout}
          </Link>
        </div>
        {state === "loading" ? (
          <p role="status">{copy.loading}</p>
        ) : state === "guest" || state === "password" ? (
          <div className={w.card}>
            <p>{state === "guest" ? copy.login : copy.password}</p>
            <Link
              prefetch={false}
              className={s.primaryButton}
              href={`/${locale}/account`}
            >
              {copy.account}
            </Link>
          </div>
        ) : state === "error" ? (
          <div>
            <ErrorNotice text={error || copy.error} />
            <button
              className={s.outlineButton}
              onClick={() => {
                if (controller.current) {
                  setState("loading");
                  void load(controller.current.signal);
                }
              }}
            >
              {copy.retry}
            </button>
          </div>
        ) : (
          wallet && (
            <>
              <div className={w.layout}>
                <section className={w.card} aria-label={copy.balance}>
                  <p className={s.eyebrow}>{copy.balance}</p>
                  <p className={w.balance} data-testid="wallet-balance">
                    {money(wallet.balance, locale)}
                  </p>
                  <p className={w.environment}>{copy[wallet.environment]}</p>
                  {wallet.frozen && (
                    <p className={w.notice} role="status">
                      {copy.frozen}
                    </p>
                  )}
                </section>
                <section className={w.card}>
                  <form className={w.form} onSubmit={submit}>
                    <h2>{copy.topup}</h2>
                    <label className={s.field}>
                      {copy.amount}
                      <input
                        required
                        type="number"
                        inputMode="numeric"
                        min="1"
                        max="100000000"
                        step="1"
                        value={amount}
                        onChange={(e) => {
                          setAmount(e.target.value);
                          setSelected(null);
                        }}
                        disabled={
                          busy || wallet.frozen || !wallet.topupAvailable
                        }
                      />
                    </label>
                    <label className={s.field}>
                      {copy.phone}
                      <input
                        required
                        type="tel"
                        autoComplete="tel"
                        minLength={10}
                        maxLength={24}
                        value={phone}
                        onChange={(e) => {
                          setPhone(e.target.value);
                          setSelected(null);
                        }}
                        placeholder="+7 (___) ___ __ __"
                        disabled={
                          busy || wallet.frozen || !wallet.topupAvailable
                        }
                      />
                    </label>
                    <p className={w.hint}>
                      {wallet.environment === "mock"
                        ? copy.mockHint
                        : wallet.environment === "sandbox"
                          ? copy.sandboxHint
                          : copy.hint}
                    </p>
                    {!wallet.topupAvailable && !wallet.frozen && (
                      <p role="status">{copy.unavailable}</p>
                    )}
                    <button
                      className={s.primaryButton}
                      type="submit"
                      disabled={
                        busy ||
                        wallet.frozen ||
                        !wallet.topupAvailable ||
                        selected?.status === "pending"
                      }
                    >
                      {busy
                        ? t.loading
                        : selected?.status === "pending"
                          ? copy.pending
                          : copy.create}
                    </button>
                    {selected && (
                      <button
                        type="button"
                        className={s.textButton}
                        disabled={busy}
                        onClick={() => {
                          clearAttempt();
                          setSelected(null);
                          setNotice("");
                        }}
                      >
                        {copy.newAttempt}
                      </button>
                    )}
                  </form>
                </section>
              </div>
              {notice && (
                <p role="status" className={w.notice}>
                  {notice}
                </p>
              )}
              {error && <ErrorNotice text={error} />}
              <section className={w.history}>
                <h2>{copy.history}</h2>
                <p className={w.hint}>{copy.recent}</p>
                {!wallet.entries.length ? (
                  <p>{copy.empty}</p>
                ) : (
                  <div className={w.tableWrap}>
                    <table className={w.table}>
                      <thead>
                        <tr>
                          <th>{copy.date}</th>
                          <th>{copy.operation}</th>
                          <th>{copy.sum}</th>
                          <th>{copy.after}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {wallet.entries.map((entry) => (
                          <tr key={entry.id}>
                            <td>{formatDate(entry.createdAt)}</td>
                            <td>
                              {copy.kinds[entry.kind]}
                              {entry.orderId && (
                                <small>
                                  {copy.order}{" "}
                                  {entry.orderId.slice(0, 8).toUpperCase()}
                                </small>
                              )}
                            </td>
                            <td
                              className={
                                ["topup_credit", "order_refund"].includes(
                                  entry.kind,
                                )
                                  ? w.credit
                                  : w.debit
                              }
                            >
                              {["topup_credit", "order_refund"].includes(
                                entry.kind,
                              )
                                ? "+"
                                : "−"}
                              {money(entry.amount, locale)}
                            </td>
                            <td>{money(entry.balanceAfter, locale)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
              <section className={w.history}>
                <h2>{copy.invoices}</h2>
                {!wallet.topups.length ? (
                  <p>{copy.emptyInvoices}</p>
                ) : (
                  <ul className={w.invoiceList}>
                    {wallet.topups.map((topup) => (
                      <li key={topup.id} className={w.invoice}>
                        <div>
                          <strong>{money(topup.amount, locale)}</strong>
                          <small>
                            {formatDate(topup.createdAt)} ·{" "}
                            {topup.id.slice(0, 8).toUpperCase()}
                          </small>
                        </div>
                        <div>
                          <span>
                            {copy.statuses[
                              topup.status as keyof typeof copy.statuses
                            ] || copy.statuses.manual_review}
                          </span>
                          {topup.simulationAllowed &&
                            topup.status === "pending" && (
                              <>
                                <button
                                  className={s.outlineButton}
                                  disabled={busy}
                                  onClick={() => void simulate(topup)}
                                >
                                  {copy.simulate}
                                </button>
                                <small>{copy.simulation}</small>
                              </>
                            )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )
        )}
      </section>
    </>
  );
}
