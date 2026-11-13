<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Иконки категорий

`src/lib/category-icons.ts` задает единый набор иконок категорий. После изменения набора выполните `npx tsx scripts/generate-category-masks.ts` из корня репозитория: `src/lib/category-masks.ts` — генерируемые статичные SVG-маски. Не редактируйте их вручную. Блик анимируется HTML-transform внутри статичной CSS-маски; сохраняйте паузу вне экрана, после загрузки фотографии и при уменьшении движения.

## Витрина и корзина

Компоненты витрины разделены по маршрутам в `src/components/shop-*.tsx`; общие элементы находятся в `shop-shell.tsx` и `shop-ui.tsx`, характеристики и быстрое добавление — в `shop-product-features.tsx`. Очередь и состояние корзины находятся в `src/lib/cart-store.ts`; ее тесты входят в `npm test` и отдельно запускаются из корня командой `npx tsx --test tests/cart-store.test.ts`. Публичные данные каталога подготавливает `src/lib/public-catalog.ts`.


## Профиль, баланс и кабинет сотрудников

- `src/components/shop-account.tsx` собирает профиль; `shop-buyer-orders.tsx`, `shop-buyer-history.tsx`, `shop-buyer-help.tsx` и `buyer-copy.ts` отвечают за покупки, локальную историю, подборки и помощь. `src/lib/buyer-device.ts` хранит правила истории и локальных отметок; `buyer-status.ts` — подписи состояний. Чистые проверки входят в `npm test` и запускаются отдельно через `npx tsx --test tests/buyer-device.test.ts`.
- `src/app/api/buyer-products/route.ts` загружает до 24 опубликованных товаров через `getPublishedProductsBySlugs` из core: один запрос товаров и одна пакетная загрузка вариантов. Сохраняйте `publicProduct` для фильтрации скрытых характеристик.
- Маршрут `src/app/[locale]/account/wallet/page.tsx` использует `shop-wallet.tsx`, `wallet-copy.ts` и `shop-wallet.module.css`; оплата с баланса встроена в `shop-checkout.tsx`. Финансовые правила и неизменяемый журнал находятся в `packages/core/src/wallet.ts`, сверка — в worker. Production-флаг по умолчанию выключен; ограничения описаны в `docs/wallet.md`.
- `src/staff/dashboard.tsx` управляет навигацией и редакторами; `insights.tsx`, `marketing.tsx`, `help.tsx` — отдельные панели. Аналитика использует общий SQL-снимок `packages/core/src/staff-insights.ts`; подтверждение wallet-продажи требует соответствующей проводки без возврата. Сохраняйте одинаковые критерии production-оплаты и реальных строк для выручки и заказов в работе.
- `npm test` включает core (в том числе аналитика, EAN-13 и финансовые сценарии), worker (ApiPay и сверка баланса), проверки безопасности, корзины и покупательской логики. Браузерные сценарии профиля, баланса, идентификаторов и кабинета находятся в `tests/e2e`.
