import type { Translations } from "./types";
export interface CategoryDefinition {
  id: string;
  names: Translations;
}
export const CATEGORIES: readonly CategoryDefinition[] = [
  {
    id: "sneakers",
    names: { ru: "Кроссовки", kk: "Кроссовкалар", en: "Sneakers" },
  },
  {
    id: "basketball-shoes",
    names: {
      ru: "Баскетбольная обувь",
      kk: "Баскетбол аяқкиімі",
      en: "Basketball shoes",
    },
  },
  {
    id: "outerwear",
    names: { ru: "Верхняя одежда", kk: "Сыртқы киім", en: "Outerwear" },
  },
  { id: "hoodies", names: { ru: "Худи", kk: "Худилер", en: "Hoodies" } },
  {
    id: "tracksuits",
    names: {
      ru: "Спортивные костюмы",
      kk: "Спорттық костюмдер",
      en: "Tracksuits",
    },
  },
  {
    id: "t-shirts",
    names: { ru: "Футболки", kk: "Футболкалар", en: "T-shirts" },
  },
  { id: "trousers", names: { ru: "Брюки", kk: "Шалбарлар", en: "Trousers" } },
  {
    id: "thermalwear",
    names: { ru: "Термобельё", kk: "Термокиім", en: "Thermal wear" },
  },
  { id: "beanies", names: { ru: "Шапки", kk: "Баскиімдер", en: "Beanies" } },
  {
    id: "backpacks",
    names: { ru: "Рюкзаки", kk: "Арқасөмкелер", en: "Backpacks" },
  },
  { id: "shirts", names: { ru: "Рубашки", kk: "Жейделер", en: "Shirts" } },
  {
    id: "sweatshirts",
    names: { ru: "Свитшоты", kk: "Свитшоттар", en: "Sweatshirts" },
  },
  { id: "shorts", names: { ru: "Шорты", kk: "Шорттар", en: "Shorts" } },
  { id: "polos", names: { ru: "Поло", kk: "Поло жейделері", en: "Polos" } },
  { id: "socks", names: { ru: "Носки", kk: "Шұлықтар", en: "Socks" } },
  { id: "vests", names: { ru: "Жилеты", kk: "Жеңсіз киімдер", en: "Vests" } },
  {
    id: "accessories",
    names: { ru: "Аксессуары", kk: "Аксессуарлар", en: "Accessories" },
  },
];
