import type { ProductDetail, Translations } from "./types";
const t = (ru: string, kk: string, en: string): Translations => ({
  ru,
  kk,
  en,
});
const detail = (
  key: string,
  label: Translations,
  value: Translations,
): ProductDetail => ({ key, label, value, enabled: true });
export const enrichedProductDetails: Record<string, ProductDetail[]> = {
  "city-tee": [
    detail(
      "material",
      t("Материал", "Материал", "Material"),
      t("Хлопковый джерси", "Мақта джерсиі", "Cotton jersey"),
    ),
    detail(
      "fit",
      t("Крой", "Пішімі", "Fit"),
      t("Свободный", "Еркін", "Relaxed"),
    ),
    detail(
      "neck",
      t("Вырез", "Жағасы", "Neckline"),
      t("Круглый", "Дөңгелек", "Crew neck"),
    ),
    detail(
      "sleeve",
      t("Рукав", "Жеңі", "Sleeve"),
      t("Короткий", "Қысқа", "Short"),
    ),
    detail(
      "hem",
      t("Низ изделия", "Етегі", "Hem"),
      t("Прямой", "Тік", "Straight"),
    ),
    detail(
      "use",
      t("Назначение", "Қолданылуы", "Use"),
      t("Повседневная одежда", "Күнделікті киім", "Everyday wear"),
    ),
  ],
  "essential-tee": [
    detail(
      "material",
      t("Материал", "Материал", "Material"),
      t("Плотный хлопок", "Тығыз мақта", "Substantial cotton"),
    ),
    detail(
      "fit",
      t("Крой", "Пішімі", "Fit"),
      t("Базовый силуэт", "Негізгі пішім", "Essential silhouette"),
    ),
    detail(
      "neck",
      t("Вырез", "Жағасы", "Neckline"),
      t("Круглый", "Дөңгелек", "Crew neck"),
    ),
    detail(
      "sleeve",
      t("Рукав", "Жеңі", "Sleeve"),
      t("Короткий", "Қысқа", "Short"),
    ),
    detail(
      "hem",
      t("Низ изделия", "Етегі", "Hem"),
      t("Прямой", "Тік", "Straight"),
    ),
    detail(
      "use",
      t("Назначение", "Қолданылуы", "Use"),
      t("Для многослойных образов", "Көпқабатты киімге", "Layering"),
    ),
  ],
  "studio-shirt": [
    detail("fit", t("Крой", "Пішімі", "Fit"), t("Прямой", "Тік", "Straight")),
    detail(
      "neck",
      t("Вырез", "Жағасы", "Neckline"),
      t("Мягкий воротник", "Жұмсақ жаға", "Soft collar"),
    ),
    detail(
      "pockets",
      t("Карманы", "Қалталары", "Pockets"),
      t("Нагрудный карман", "Кеуде қалтасы", "Chest pocket"),
    ),
    detail(
      "sleeve",
      t("Рукав", "Жеңі", "Sleeve"),
      t("Длинный", "Ұзын", "Long"),
    ),
    detail(
      "closure",
      t("Застёжка", "Ілгегі", "Closure"),
      t("Пуговицы", "Түймелер", "Buttons"),
    ),
    detail(
      "use",
      t("Назначение", "Қолданылуы", "Use"),
      t("Для города и офиса", "Қала мен кеңсеге", "City and office wear"),
    ),
  ],
  "linen-shirt": [
    detail(
      "material",
      t("Материал", "Материал", "Material"),
      t(
        "Лёгкая фактурная ткань",
        "Жеңіл бедерлі мата",
        "Light textured fabric",
      ),
    ),
    detail(
      "fit",
      t("Крой", "Пішімі", "Fit"),
      t("Свободный", "Еркін", "Relaxed"),
    ),
    detail(
      "sleeve",
      t("Рукав", "Жеңі", "Sleeve"),
      t("Свободный длинный", "Кең ұзын жең", "Loose long sleeves"),
    ),
    detail(
      "neck",
      t("Вырез", "Жағасы", "Neckline"),
      t("Отложной воротник", "Қайырма жаға", "Turn-down collar"),
    ),
    detail(
      "closure",
      t("Застёжка", "Ілгегі", "Closure"),
      t("Пуговицы", "Түймелер", "Buttons"),
    ),
    detail(
      "shape",
      t("Форма", "Пішін", "Shape"),
      t("Спущенная линия плеча", "Түсірілген иық", "Dropped shoulders"),
    ),
  ],
  "heavy-hoodie": [
    detail(
      "material",
      t("Материал", "Материал", "Material"),
      t("Плотный футер", "Тығыз футер", "Heavyweight fleece"),
    ),
    detail("fit", t("Крой", "Пішімі", "Fit"), t("Объёмный", "Кең", "Generous")),
    detail(
      "neck",
      t("Вырез", "Жағасы", "Neckline"),
      t("Капюшон", "Капюшон", "Hood"),
    ),
    detail(
      "sleeve",
      t("Рукав", "Жеңі", "Sleeve"),
      t("Длинный", "Ұзын", "Long"),
    ),
    detail(
      "hem",
      t("Низ изделия", "Етегі", "Hem"),
      t("Эластичный край", "Серпімді жиек", "Stretch hem"),
    ),
    detail(
      "use",
      t("Назначение", "Қолданылуы", "Use"),
      t("Прохладная погода", "Салқын ауа райы", "Cool weather"),
    ),
  ],
  "weekend-hoodie": [
    detail(
      "fit",
      t("Крой", "Пішімі", "Fit"),
      t("Свободный", "Еркін", "Relaxed"),
    ),
    detail(
      "neck",
      t("Вырез", "Жағасы", "Neckline"),
      t("Глубокий капюшон", "Терең капюшон", "Deep hood"),
    ),
    detail(
      "pockets",
      t("Карманы", "Қалталары", "Pockets"),
      t("Кенгуру", "Кенгуру", "Kangaroo pocket"),
    ),
    detail(
      "sleeve",
      t("Рукав", "Жеңі", "Sleeve"),
      t("Длинный", "Ұзын", "Long"),
    ),
    detail(
      "closure",
      t("Застёжка", "Ілгегі", "Closure"),
      t("Без застёжки", "Ілгексіз", "Pullover"),
    ),
    detail(
      "use",
      t("Назначение", "Қолданылуы", "Use"),
      t("Прогулки и выходные", "Серуен және демалыс", "Walks and weekends"),
    ),
  ],
  "shell-jacket": [
    detail(
      "material",
      t("Материал", "Материал", "Material"),
      t("Лёгкая ткань", "Жеңіл мата", "Lightweight fabric"),
    ),
    detail(
      "neck",
      t("Вырез", "Жағасы", "Neckline"),
      t("Высокий ворот", "Биік жаға", "High collar"),
    ),
    detail(
      "hem",
      t("Низ изделия", "Етегі", "Hem"),
      t("Регулируемый", "Реттелетін", "Adjustable"),
    ),
    detail(
      "sleeve",
      t("Рукав", "Жеңі", "Sleeve"),
      t("Длинный", "Ұзын", "Long"),
    ),
    detail(
      "closure",
      t("Застёжка", "Ілгегі", "Closure"),
      t("Молния", "Сыдырма", "Zip"),
    ),
    detail(
      "use",
      t("Назначение", "Қолданылуы", "Use"),
      t("Городская верхняя одежда", "Қалалық сырт киім", "City outerwear"),
    ),
  ],
  "field-jacket": [
    detail(
      "material",
      t("Материал", "Материал", "Material"),
      t("Плотная ткань", "Тығыз мата", "Sturdy fabric"),
    ),
    detail(
      "fit",
      t("Крой", "Пішімі", "Fit"),
      t("Утилитарный силуэт", "Ыңғайлы пішім", "Utility silhouette"),
    ),
    detail(
      "pockets",
      t("Карманы", "Қалталары", "Pockets"),
      t(
        "Вместительные накладные",
        "Сыйымды жапсырма",
        "Generous patch pockets",
      ),
    ),
    detail(
      "sleeve",
      t("Рукав", "Жеңі", "Sleeve"),
      t("Длинный", "Ұзын", "Long"),
    ),
    detail(
      "neck",
      t("Вырез", "Жағасы", "Neckline"),
      t("Отложной воротник", "Қайырма жаға", "Turn-down collar"),
    ),
    detail(
      "use",
      t("Назначение", "Қолданылуы", "Use"),
      t("Для города и прогулок", "Қалаға және серуенге", "City wear and walks"),
    ),
  ],
  "wide-trousers": [
    detail(
      "fit",
      t("Крой", "Пішімі", "Fit"),
      t("Широкие штанины", "Кең балақ", "Wide leg"),
    ),
    detail(
      "waist",
      t("Посадка", "Бел тұсы", "Rise"),
      t("Высокая", "Биік", "High"),
    ),
    detail(
      "shape",
      t("Форма", "Пішін", "Shape"),
      t("Мягкие складки", "Жұмсақ қатпарлар", "Soft pleats"),
    ),
    detail(
      "closure",
      t("Застёжка", "Ілгегі", "Closure"),
      t("Пояс с застёжкой", "Ілгекті белдік", "Fastened waistband"),
    ),
    detail(
      "hem",
      t("Низ изделия", "Етегі", "Hem"),
      t("Прямой", "Тік", "Straight"),
    ),
    detail(
      "use",
      t("Назначение", "Қолданылуы", "Use"),
      t("Повседневные образы", "Күнделікті киім", "Everyday outfits"),
    ),
  ],
  "daily-chino": [
    detail(
      "material",
      t("Материал", "Материал", "Material"),
      t("Хлопковая саржа", "Мақта саржа", "Cotton twill"),
    ),
    detail("fit", t("Крой", "Пішімі", "Fit"), t("Прямой", "Тік", "Straight")),
    detail(
      "waist",
      t("Посадка", "Бел тұсы", "Rise"),
      t("Средняя", "Орташа", "Mid rise"),
    ),
    detail(
      "pockets",
      t("Карманы", "Қалталары", "Pockets"),
      t("Боковые", "Бүйір", "Side pockets"),
    ),
    detail(
      "hem",
      t("Низ изделия", "Етегі", "Hem"),
      t("Прямой", "Тік", "Straight"),
    ),
    detail(
      "use",
      t("Назначение", "Қолданылуы", "Use"),
      t("Город и выходные", "Қала және демалыс", "City and weekends"),
    ),
  ],
  "canvas-tote": [
    detail(
      "material",
      t("Материал", "Материал", "Material"),
      t("Плотный канвас", "Тығыз кенеп", "Heavyweight canvas"),
    ),
    detail(
      "handles",
      t("Ручки", "Тұтқалары", "Handles"),
      t("Длинные, на плечо", "Иыққа асатын ұзын", "Long shoulder handles"),
    ),
    detail(
      "shape",
      t("Форма", "Пішін", "Shape"),
      t("Вместительный шопер", "Сыйымды шопер", "Roomy tote"),
    ),
    detail(
      "closure",
      t("Застёжка", "Ілгегі", "Closure"),
      t("Открытый верх", "Ашық үсті", "Open top"),
    ),
    detail(
      "fit",
      t("Крой", "Пішімі", "Fit"),
      t("Один размер", "Бір өлшем", "One size"),
    ),
    detail(
      "use",
      t("Назначение", "Қолданылуы", "Use"),
      t("Покупки и прогулки", "Сауда және серуен", "Shopping and walks"),
    ),
  ],
  "court-sneakers": [
    detail(
      "height",
      t("Высота", "Биіктігі", "Height"),
      t("Низкие", "Аласа", "Low top"),
    ),
    detail(
      "sole",
      t("Подошва", "Табаны", "Sole"),
      t("Гибкая", "Иілгіш", "Flexible"),
    ),
    detail(
      "footbed",
      t("Стелька", "Ұлтарағы", "Footbed"),
      t("Мягкая", "Жұмсақ", "Cushioned"),
    ),
    detail(
      "closure",
      t("Застёжка", "Ілгегі", "Closure"),
      t("Шнуровка", "Бау", "Laces"),
    ),
    detail(
      "shape",
      t("Форма", "Пішін", "Shape"),
      t("Лаконичный силуэт", "Ықшам пішін", "Clean silhouette"),
    ),
    detail(
      "use",
      t("Назначение", "Қолданылуы", "Use"),
      t("Повседневная обувь", "Күнделікті аяқкиім", "Everyday footwear"),
    ),
  ],
  "demo-backpacks-city-graphite": [
    detail(
      "shape",
      t("Форма", "Пішін", "Shape"),
      t("Городской рюкзак", "Қалалық арқасөмке", "City backpack"),
    ),
    detail(
      "closure",
      t("Застёжка", "Ілгегі", "Closure"),
      t("Молния", "Сыдырма", "Zip"),
    ),
    detail(
      "handles",
      t("Ручки", "Тұтқалары", "Handles"),
      t("Две плечевые лямки", "Екі иық бауы", "Two shoulder straps"),
    ),
    detail(
      "pockets",
      t("Карманы", "Қалталары", "Pockets"),
      t("Внешний карман", "Сыртқы қалта", "Outer pocket"),
    ),
    detail(
      "fit",
      t("Крой", "Пішімі", "Fit"),
      t("Один размер", "Бір өлшем", "One size"),
    ),
    detail(
      "use",
      t("Назначение", "Қолданылуы", "Use"),
      t("Ежедневные маршруты", "Күнделікті бағыттар", "Daily journeys"),
    ),
  ],
  "demo-beanies-cuff-graphite": [
    detail(
      "shape",
      t("Форма", "Пішін", "Shape"),
      t("Шапка с отворотом", "Қайырмалы баскиім", "Cuffed beanie"),
    ),
    detail(
      "material",
      t("Материал", "Материал", "Material"),
      t("Трикотаж", "Тоқыма", "Knit"),
    ),
    detail(
      "fit",
      t("Крой", "Пішімі", "Fit"),
      t("Один размер", "Бір өлшем", "One size"),
    ),
    detail(
      "hem",
      t("Низ изделия", "Етегі", "Hem"),
      t("Широкий отворот", "Кең қайырма", "Wide cuff"),
    ),
    detail(
      "height",
      t("Высота", "Биіктігі", "Height"),
      t("Закрывает уши", "Құлақты жабады", "Ear covering"),
    ),
    detail(
      "use",
      t("Назначение", "Қолданылуы", "Use"),
      t("Прохладная погода", "Салқын ауа райы", "Cool weather"),
    ),
  ],
  "demo-polos-classic-graphite": [
    detail(
      "fit",
      t("Крой", "Пішімі", "Fit"),
      t("Классический", "Классикалық", "Classic"),
    ),
    detail(
      "neck",
      t("Вырез", "Жағасы", "Neckline"),
      t("Воротник поло", "Поло жағасы", "Polo collar"),
    ),
    detail(
      "sleeve",
      t("Рукав", "Жеңі", "Sleeve"),
      t("Короткий", "Қысқа", "Short"),
    ),
    detail(
      "closure",
      t("Застёжка", "Ілгегі", "Closure"),
      t("Планка с пуговицами", "Түймелі өңір", "Button placket"),
    ),
    detail(
      "hem",
      t("Низ изделия", "Етегі", "Hem"),
      t("Прямой", "Тік", "Straight"),
    ),
    detail(
      "use",
      t("Назначение", "Қолданылуы", "Use"),
      t("Повседневная одежда", "Күнделікті киім", "Everyday wear"),
    ),
  ],
};
export const enrichedDescriptions: Record<string, Translations> =
  Object.fromEntries(
    Object.entries(enrichedProductDetails).map(([slug, details]) => [
      slug,
      {
        ru:
          details
            .map((d) => `${d.label.ru}: ${d.value.ru.toLowerCase()}`)
            .join(". ") + ".",
        kk:
          details
            .map((d) => `${d.label.kk}: ${d.value.kk.toLowerCase()}`)
            .join(". ") + ".",
        en:
          details
            .map((d) => `${d.label.en}: ${d.value.en.toLowerCase()}`)
            .join(". ") + ".",
      },
    ]),
  );
