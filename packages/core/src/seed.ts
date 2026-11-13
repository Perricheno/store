import { enrichedProductDetails, enrichedDescriptions } from "./seed-details";
import { CATEGORIES } from "./categories";
import type { Translations } from "./types";
import type { DB } from "./db";
const catalog = [
  [
    "city-tee",
    "t-shirts",
    "unisex",
    "Футболка City",
    "City футболкасы",
    "City tee",
    12900,
    "Графит",
    "Мягкий хлопковый джерси, свободный крой и аккуратный круглый вырез.",
    "Жұмсақ мақта джерсиі, еркін пішім және ұқыпты дөңгелек жаға.",
    "Soft cotton jersey with a relaxed fit and a clean crew neck.",
  ],
  [
    "essential-tee",
    "t-shirts",
    "unisex",
    "Футболка Essential",
    "Essential футболкасы",
    "Essential tee",
    9900,
    "Молочный",
    "Базовый силуэт из плотного хлопка для многослойных образов.",
    "Көпқабатты киімге арналған тығыз мақтадан жасалған негізгі үлгі.",
    "An everyday silhouette in substantial cotton for effortless layering.",
  ],
  [
    "studio-shirt",
    "shirts",
    "men",
    "Рубашка Studio",
    "Studio жейдесі",
    "Studio shirt",
    24900,
    "Голубой",
    "Прямая рубашка с мягким воротником и нагрудным карманом.",
    "Жұмсақ жағалы және кеуде қалталы тік пішімді жейде.",
    "A straight-cut shirt with a soft collar and a chest pocket.",
  ],
  [
    "linen-shirt",
    "shirts",
    "women",
    "Рубашка Linen",
    "Linen жейдесі",
    "Linen shirt",
    27900,
    "Песочный",
    "Лёгкая фактурная ткань, спущенное плечо и свободный рукав.",
    "Жеңіл бедерлі мата, түсірілген иық және кең жең.",
    "Light textured fabric with dropped shoulders and easy sleeves.",
  ],
  [
    "heavy-hoodie",
    "hoodies",
    "unisex",
    "Худи Heavy",
    "Heavy худиі",
    "Heavy hoodie",
    32900,
    "Графит",
    "Объёмное худи из плотного футера с мягкой внутренней стороной.",
    "Ішкі жағы жұмсақ, тығыз футерден тігілген кең худи.",
    "A generous hoodie in heavyweight fleece with a soft interior.",
  ],
  [
    "weekend-hoodie",
    "hoodies",
    "unisex",
    "Худи Weekend",
    "Weekend худиі",
    "Weekend hoodie",
    29900,
    "Шалфей",
    "Спокойный цвет, глубокий капюшон и удобный карман-кенгуру.",
    "Байсалды түс, терең капюшон және ыңғайлы кенгуру қалта.",
    "A calm colour, deep hood and a practical kangaroo pocket.",
  ],
  [
    "shell-jacket",
    "outerwear",
    "unisex",
    "Куртка Shell",
    "Shell күртешесі",
    "Shell jacket",
    59900,
    "Чёрный",
    "Лёгкая городская куртка с регулируемым низом и высоким воротом.",
    "Етегі реттелетін және жағасы биік жеңіл қалалық күртеше.",
    "A lightweight city jacket with an adjustable hem and a high collar.",
  ],
  [
    "field-jacket",
    "outerwear",
    "men",
    "Куртка Field",
    "Field күртешесі",
    "Field jacket",
    64900,
    "Оливковый",
    "Утилитарный силуэт, вместительные карманы и плотная ткань.",
    "Ыңғайлы пішім, сыйымды қалталар және тығыз мата.",
    "A practical silhouette with generous pockets and sturdy fabric.",
  ],
  [
    "wide-trousers",
    "trousers",
    "women",
    "Брюки Wide",
    "Wide шалбары",
    "Wide trousers",
    34900,
    "Чёрный",
    "Свободные брюки с высокой посадкой и мягкими складками.",
    "Бел тұсы биік және жұмсақ қатпарлы кең шалбар.",
    "Wide-leg trousers with a high waist and soft pleats.",
  ],
  [
    "daily-chino",
    "trousers",
    "men",
    "Брюки Daily",
    "Daily шалбары",
    "Daily chinos",
    29900,
    "Песочный",
    "Прямые брюки из хлопковой саржи для города и выходных.",
    "Қалаға және демалысқа арналған мақта саржадан тігілген тік шалбар.",
    "Straight cotton-twill trousers for the city and the weekend.",
  ],
  [
    "canvas-tote",
    "accessories",
    "unisex",
    "Сумка Canvas",
    "Canvas сөмкесі",
    "Canvas tote",
    14900,
    "Натуральный",
    "Вместительный шопер из плотного канваса с длинными ручками.",
    "Ұзын тұтқалы, тығыз кенептен жасалған сыйымды сөмке.",
    "A roomy heavyweight canvas tote with long shoulder handles.",
  ],
  [
    "court-sneakers",
    "sneakers",
    "unisex",
    "Кеды Court",
    "Court кедтері",
    "Court sneakers",
    42900,
    "Молочный",
    "Лаконичные низкие кеды с мягкой стелькой и гибкой подошвой.",
    "Жұмсақ ұлтарақты және иілгіш табанды ықшам аласа кедтер.",
    "Clean low-top sneakers with a cushioned footbed and flexible sole.",
  ],
] as const;
type Style = readonly [code: string, ru: string, kk: string, en: string];
const styles: Record<string, readonly Style[]> = {
  sneakers: [
    ["low", "Низкие кроссовки", "Аласа кроссовкалар", "Low-top sneakers"],
    ["retro", "Ретро-кроссовки", "Ретро кроссовкалар", "Retro sneakers"],
    [
      "runner",
      "Беговой силуэт",
      "Жүгіру үлгісіндегі кроссовкалар",
      "Runner silhouette sneakers",
    ],
    [
      "chunky",
      "Кроссовки на объёмной подошве",
      "Көлемді табанды кроссовкалар",
      "Chunky-sole sneakers",
    ],
  ],
  "basketball-shoes": [
    [
      "high",
      "Высокие баскетбольные кроссовки",
      "Биік баскетбол кроссовкалары",
      "High-top basketball shoes",
    ],
    [
      "mid",
      "Средние баскетбольные кроссовки",
      "Орташа биік баскетбол кроссовкалары",
      "Mid-top basketball shoes",
    ],
    [
      "low",
      "Низкие баскетбольные кроссовки",
      "Аласа баскетбол кроссовкалары",
      "Low-top basketball shoes",
    ],
    [
      "court",
      "Баскетбольные кроссовки Court",
      "Court баскетбол кроссовкалары",
      "Court basketball shoes",
    ],
  ],
  outerwear: [
    ["bomber", "Куртка-бомбер", "Бомбер күртешесі", "Bomber jacket"],
    ["parka", "Парка с капюшоном", "Капюшонды парка", "Hooded parka"],
    ["windbreaker", "Ветровка", "Желден қорғайтын күртеше", "Windbreaker"],
    ["coach", "Куртка на кнопках", "Батырмалы күртеше", "Snap-front jacket"],
  ],
  hoodies: [
    ["pullover", "Худи без молнии", "Сыдырмасыз худи", "Pullover hoodie"],
    ["zip", "Худи на молнии", "Сыдырмалы худи", "Zip hoodie"],
    ["cropped", "Укороченное худи", "Қысқа худи", "Cropped hoodie"],
    ["raglan", "Худи с рукавом реглан", "Реглан жеңді худи", "Raglan hoodie"],
  ],
  tracksuits: [
    [
      "straight",
      "Спортивный костюм прямого кроя",
      "Тік пішімді спорттық костюм",
      "Straight-fit tracksuit",
    ],
    [
      "hooded",
      "Спортивный костюм с капюшоном",
      "Капюшонды спорттық костюм",
      "Hooded tracksuit",
    ],
    [
      "zip",
      "Спортивный костюм на молнии",
      "Сыдырмалы спорттық костюм",
      "Zip-front tracksuit",
    ],
    [
      "relaxed",
      "Свободный спортивный костюм",
      "Кең спорттық костюм",
      "Relaxed tracksuit",
    ],
  ],
  "t-shirts": [
    [
      "crew",
      "Футболка с круглым вырезом",
      "Дөңгелек жағалы футболка",
      "Crew-neck tee",
    ],
    ["boxy", "Футболка широкого кроя", "Кең пішімді футболка", "Boxy tee"],
    [
      "longsleeve",
      "Футболка с длинным рукавом",
      "Ұзын жеңді футболка",
      "Long-sleeve tee",
    ],
    ["pocket", "Футболка с карманом", "Қалталы футболка", "Pocket tee"],
  ],
  trousers: [
    ["cargo", "Брюки карго", "Карго шалбары", "Cargo trousers"],
    ["chino", "Брюки чинос", "Чинос шалбары", "Chinos"],
    ["wide", "Широкие брюки", "Кең шалбар", "Wide-leg trousers"],
    ["jogger", "Брюки джоггеры", "Джоггер шалбары", "Joggers"],
  ],
  thermalwear: [
    [
      "top",
      "Термолонгслив",
      "Ұзын жеңді терможейде",
      "Thermal long-sleeve top",
    ],
    ["bottom", "Термокальсоны", "Термошалбар", "Thermal leggings"],
    [
      "set",
      "Комплект термобелья",
      "Термокиім жиынтығы",
      "Thermal base-layer set",
    ],
    [
      "zipneck",
      "Термоджемпер с молнией у ворота",
      "Жағасы сыдырмалы термокөйлек",
      "Zip-neck thermal top",
    ],
  ],
  beanies: [
    ["cuff", "Шапка с отворотом", "Қайырмалы баскиім", "Cuffed beanie"],
    ["short", "Короткая шапка", "Қысқа баскиім", "Short beanie"],
    ["rib", "Шапка в рубчик", "Бедерлі баскиім", "Ribbed beanie"],
    ["slouch", "Удлинённая шапка", "Ұзын баскиім", "Slouch beanie"],
  ],
  backpacks: [
    ["city", "Городской рюкзак", "Қалалық арқасөмке", "City backpack"],
    [
      "rolltop",
      "Рюкзак с роллтопом",
      "Оралмалы арқасөмке",
      "Roll-top backpack",
    ],
    [
      "daypack",
      "Рюкзак на каждый день",
      "Күнделікті арқасөмке",
      "Everyday daypack",
    ],
    [
      "drawstring",
      "Рюкзак на шнурке",
      "Баулы арқасөмке",
      "Drawstring backpack",
    ],
  ],
  shirts: [
    [
      "straight",
      "Рубашка прямого кроя",
      "Тік пішімді жейде",
      "Straight-cut shirt",
    ],
    ["overshirt", "Рубашка-овершихт", "Кең сырт жейде", "Overshirt"],
    [
      "collarless",
      "Рубашка без воротника",
      "Жағасыз жейде",
      "Collarless shirt",
    ],
    [
      "shortsleeve",
      "Рубашка с коротким рукавом",
      "Қысқа жеңді жейде",
      "Short-sleeve shirt",
    ],
  ],
  sweatshirts: [
    [
      "crew",
      "Свитшот с круглым вырезом",
      "Дөңгелек жағалы свитшот",
      "Crew-neck sweatshirt",
    ],
    [
      "raglan",
      "Свитшот с рукавом реглан",
      "Реглан жеңді свитшот",
      "Raglan sweatshirt",
    ],
    [
      "halfzip",
      "Свитшот с короткой молнией",
      "Қысқа сыдырмалы свитшот",
      "Half-zip sweatshirt",
    ],
    ["relaxed", "Свободный свитшот", "Кең свитшот", "Relaxed sweatshirt"],
  ],
  shorts: [
    ["cargo", "Шорты карго", "Карго шорты", "Cargo shorts"],
    ["court", "Баскетбольные шорты", "Баскетбол шорты", "Basketball shorts"],
    ["bermuda", "Шорты-бермуды", "Бермуд шорты", "Bermuda shorts"],
    ["drawstring", "Шорты на шнурке", "Баулы шорт", "Drawstring shorts"],
  ],
  polos: [
    [
      "classic",
      "Поло классического кроя",
      "Классикалық пішімді поло",
      "Classic polo",
    ],
    [
      "longsleeve",
      "Поло с длинным рукавом",
      "Ұзын жеңді поло",
      "Long-sleeve polo",
    ],
    ["zip", "Поло на молнии", "Сыдырмалы поло", "Zip-neck polo"],
    ["relaxed", "Поло свободного кроя", "Кең пішімді поло", "Relaxed polo"],
  ],
  socks: [
    ["crew", "Носки средней высоты", "Орташа ұзын шұлық", "Crew socks"],
    ["ankle", "Короткие носки", "Қысқа шұлық", "Ankle socks"],
    ["high", "Высокие носки", "Ұзын шұлық", "High socks"],
    ["rib", "Носки в рубчик", "Бедерлі шұлық", "Ribbed socks"],
  ],
  vests: [
    ["zip", "Жилет на молнии", "Сыдырмалы жеңсіз киім", "Zip-front vest"],
    ["padded", "Стёганый жилет", "Сырылған жеңсіз киім", "Quilted vest"],
    ["utility", "Жилет с карманами", "Қалталы жеңсіз киім", "Utility vest"],
    ["pullover", "Жилет без застёжки", "Түймесіз жеңсіз киім", "Pullover vest"],
  ],
  accessories: [
    ["tote", "Сумка-шопер", "Шопер сөмкесі", "Tote bag"],
    ["crossbody", "Сумка через плечо", "Иыққа асатын сөмке", "Crossbody bag"],
    ["waist", "Поясная сумка", "Белге тағатын сөмке", "Waist bag"],
    ["cap", "Кепка", "Кепка", "Cap"],
  ],
};
const colors: readonly Style[] = [
  ["graphite", "Графит", "Графит", "Graphite"],
  ["black", "Чёрный", "Қара", "Black"],
  ["ivory", "Молочный", "Сүт түсті", "Ivory"],
  ["navy", "Тёмно-синий", "Қою көк", "Navy"],
  ["olive", "Оливковый", "Зәйтүн түсті", "Olive"],
  ["sand", "Песочный", "Құм түсті", "Sand"],
  ["burgundy", "Бордовый", "Күрең", "Burgundy"],
  ["ice", "Ледяной голубой", "Мұздай көгілдір", "Ice blue"],
];
const basePrices: Record<string, number> = {
  sneakers: 34900,
  "basketball-shoes": 42900,
  outerwear: 39900,
  hoodies: 24900,
  tracksuits: 38900,
  "t-shirts": 8900,
  trousers: 24900,
  thermalwear: 14900,
  beanies: 6900,
  backpacks: 14900,
  shirts: 19900,
  sweatshirts: 21900,
  shorts: 12900,
  polos: 15900,
  socks: 1900,
  vests: 22900,
  accessories: 5900,
};
interface DemoRecord {
  id: string;
  slug: string;
  category: string;
  gender: string;
  brand: string;
  names: Translations;
  description: Translations;
  price: number;
  media: string[];
  sizes: string[];
  color: string;
  quantity: number;
}
const emptyDescription = (): Translations => ({ ru: "", kk: "", en: "" });
function demoRecords(): DemoRecord[] {
  const originals: DemoRecord[] = catalog.map(
    ([slug, category, gender, ru, kk, en, price, color, dru, dkk, den]) => ({
      id: `demo-${slug}`,
      slug,
      category,
      gender,
      brand: "DEMO",
      names: { ru, kk, en },
      description: { ru: dru, kk: dkk, en: den },
      price,
      media: [],
      sizes:
        category === "accessories"
          ? ["ONE SIZE"]
          : category === "sneakers"
            ? ["37", "38", "39", "40", "41", "42", "43"]
            : ["XS", "S", "M", "L", "XL"],
      color,
      quantity: 8,
    }),
  );
  const records = [...originals];
  CATEGORIES.forEach(({ id: category }, categoryIndex) => {
    const count = 28 + (categoryIndex < 12 ? 1 : 0);
    for (let i = 0; i < count; i++) {
      const style = styles[category]![Math.floor(i / colors.length)]!,
        color = colors[i % colors.length]!,
        slug = `demo-${category}-${style[0]}-${color[0]}`;
      const footwear = ["sneakers", "basketball-shoes"].includes(category),
        oneSize = ["beanies", "backpacks", "accessories"].includes(category);
      records.push({
        id: `demo-z-${category}-${style[0]}-${color[0]}`,
        slug,
        category,
        gender:
          footwear || oneSize || category === "socks"
            ? "unisex"
            : ["unisex", "men", "women", "unisex"][
                Math.floor(i / colors.length)
              ]!,
        brand: "DEMO",
        names: {
          ru: `${style[1]} · ${color[1]}`,
          kk: `${style[2]} · ${color[2]}`,
          en: `${style[3]} · ${color[3]}`,
        },
        description: emptyDescription(),
        price:
          basePrices[category]! +
          Math.floor(i / colors.length) * 1500 +
          (i % colors.length) * 300,
        media: [],
        sizes: oneSize
          ? ["ONE SIZE"]
          : category === "socks"
            ? ["35–38", "39–42", "43–46"]
            : footwear
              ? ["37", "38", "39", "40", "41", "42", "43"]
              : ["XS", "S", "M", "L", "XL"],
        color: color[1],
        quantity: i % 11 === 0 ? 0 : 2 + (i % 7),
      });
    }
  });
  return records;
}
export async function seed(db: DB) {
  await db.exec(
    "CREATE TABLE IF NOT EXISTS seed_migrations(version text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())",
  );
  const claimed = await db.query(
    "INSERT INTO seed_migrations(version) VALUES('demo-catalog-500-v1') ON CONFLICT DO NOTHING RETURNING version",
  );
  if (!claimed.length) {
    await enrichProducts(db);
    return;
  }
  const records = demoRecords(),
    inserted = new Set<string>();
  // Correct only unchanged original fixture branding/discounts, never staff/user catalog data.
  const legacy = records.slice(0, 12);
  await db.query(
    `UPDATE products p SET old_price=NULL,brand='DEMO' FROM jsonb_to_recordset($1::jsonb) AS x(id text,slug text,names jsonb) WHERE p.id=x.id AND p.slug=x.slug AND p.names=x.names AND p.is_demo=true AND p.brand='URBANMAG'`,
    [
      JSON.stringify(
        legacy.map(({ id, slug, names }) => ({ id, slug, names })),
      ),
    ],
  );
  for (let offset = 0; offset < records.length; offset += 100) {
    const rows = await db.query(
      `INSERT INTO products(id,slug,category,gender,brand,names,description,price,media,is_demo,published)
   SELECT x.id,x.slug,x.category,x.gender,x.brand,x.names,x.description,x.price,x.media,true,true
   FROM jsonb_to_recordset($1::jsonb) AS x(id text,slug text,category text,gender text,brand text,names jsonb,description jsonb,price integer,media jsonb)
   ON CONFLICT DO NOTHING RETURNING id`,
      [JSON.stringify(records.slice(offset, offset + 100))],
    );
    for (const row of rows) inserted.add(row.id);
  }
  const variants = records
    .filter((record) => inserted.has(record.id))
    .flatMap((record) =>
      record.sizes.map((size) => ({
        id: `${record.id}-${size.toLowerCase().replace(/ /g, "-")}`,
        product_id: record.id,
        size,
        color: record.color,
        quantity: record.quantity,
      })),
    );
  for (let offset = 0; offset < variants.length; offset += 250) {
    const batch = JSON.stringify(variants.slice(offset, offset + 250));
    await db.query(
      `INSERT INTO variants(id,product_id,size,color) SELECT x.id,x.product_id,x.size,x.color FROM jsonb_to_recordset($1::jsonb) AS x(id text,product_id text,size text,color text) ON CONFLICT DO NOTHING`,
      [batch],
    );
    await db.query(
      `INSERT INTO inventory(variant_id,branch_id,quantity,reserved) SELECT x.id,'main',x.quantity,0 FROM jsonb_to_recordset($1::jsonb) AS x(id text,quantity integer) ON CONFLICT DO NOTHING`,
      [batch],
    );
  }
  await enrichProducts(db);
}

async function enrichProducts(db: DB) {
  const claimed = await db.query(
    "INSERT INTO seed_migrations(version) VALUES('product-details-15-v1') ON CONFLICT DO NOTHING RETURNING version",
  );
  if (!claimed.length) return;
  const records = demoRecords().filter(
    (record) => enrichedProductDetails[record.slug],
  );
  for (const record of records) {
    // Match the full unchanged sample identity/content before enriching; staff edits win.
    await db.query(
      `UPDATE products SET details=$1::jsonb,description=$2::jsonb WHERE id=$3 AND slug=$4 AND is_demo=true AND names=$5::jsonb AND description=$6::jsonb AND category=$7 AND gender=$8 AND brand=$9 AND price=$10 AND media=$11::jsonb AND old_price IS NULL AND kaspi_url IS NULL AND published=true AND details='[]'::jsonb AND promotion IS NULL AND NOT EXISTS (SELECT 1 FROM audit WHERE entity_id=$3 AND action IN ('product.updated','product.created'))`,
      [
        JSON.stringify(enrichedProductDetails[record.slug]),
        JSON.stringify(enrichedDescriptions[record.slug]),
        record.id,
        record.slug,
        JSON.stringify(record.names),
        JSON.stringify(record.description),
        record.category,
        record.gender,
        record.brand,
        record.price,
        JSON.stringify(record.media),
      ],
    );
  }
}
