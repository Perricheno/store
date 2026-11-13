import { notFound } from "next/navigation";
import { isLocale } from "@/lib/config";
import { ShopShell } from "@/components/shop";
import { getSettings } from "@urbanmag/core";
import s from "@/components/shop.module.css";
export const dynamic = "force-dynamic";

const content = {
  ru: {
    title: "О cookies",
    intro:
      "Urbanmag использует необходимые cookies, чтобы сохранять корзину и обеспечивать вход в аккаунт.",
    items: [
      "Идентификатор посетителя сохраняет корзину и избранное на 90 дней.",
      "Сессия входа и доступ к оформленному заказу действуют до 30 дней.",
      "В cookies не сохраняются пароль, номер телефона или содержимое корзины.",
      "Сбросить cookies можно в настройках браузера. После этого потребуется войти заново.",
    ],
    note: "Рекламные трекеры и маркетинговые cookies сейчас не используются.",
  },
  kk: {
    title: "Cookies туралы",
    intro:
      "Urbanmag себетті сақтау және аккаунтқа кіру үшін қажетті cookies қолданады.",
    items: [
      "Келуші идентификаторы себет пен таңдаулыларды 90 күн сақтайды.",
      "Кіру сессиясы мен тапсырысқа қолжетімділік 30 күнге дейін жарамды.",
      "Cookies ішінде құпиясөз, телефон нөмірі немесе себет құрамы сақталмайды.",
      "Cookies браузер баптауларынан тазаланады. Содан кейін қайта кіру қажет.",
    ],
    note: "Жарнамалық трекерлер мен маркетингтік cookies қазір қолданылмайды.",
  },
  en: {
    title: "About cookies",
    intro:
      "Urbanmag uses essential cookies to remember your bag and keep your account secure.",
    items: [
      "A visitor identifier remembers your bag and saved items for 90 days.",
      "Sign-in sessions and access to a placed order last up to 30 days.",
      "Cookies do not contain your password, phone number or bag contents.",
      "You can clear cookies in your browser settings. You will need to sign in again.",
    ],
    note: "Advertising trackers and marketing cookies are not currently used.",
  },
};
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = content[locale];
  const settings = await getSettings();
  return (
    <ShopShell locale={locale} settings={settings}>
      <article className={s.informationPage}>
        <h1>
          {t.title}
          <span className={s.titleDot}>.</span>
        </h1>
        <div className={s.informationBody}>
          <p>{t.intro}</p>
          <ul>
            {t.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p>{t.note}</p>
        </div>
      </article>
    </ShopShell>
  );
}
