import s from "./dashboard.module.css";
const copy = {
  ru: {
    title: "Помощь сотруднику",
    intro: "Порядок работы с каталогом и заказами Urbanmag.",
    sections: [
      [
        "Сводка и аналитика",
        "Выберите период 7, 30, 90 или 365 дней. Выручка включает только завершённые заказы с подтверждённой полной production-оплатой. Оплаченные заказы в работе показаны отдельно. Раскройте «Качество данных», чтобы проверить исключения. Нулевое значение означает отсутствие подходящих записей, а не ошибку оплаты.",
      ],
      [
        "Товары и остатки",
        "Откройте «Товары», найдите товар по названию, бренду, адресу или категории и нажмите «Изменить». Заполните три языковые версии. Переключатель характеристики скрывает строку на витрине и сохраняет её данные. Бейдж акции не меняет цену: укажите цену отдельно. Для изменения остатков нажмите размер в таблице, выберите филиал и сохраните количество.",
      ],
      [
        "Обработка заказов",
        "Откройте «Заказы» и карточку нужного заказа. После подтверждённой оплаты последовательно переводите заказ в обработку, готовность к выдаче и завершение. Завершайте заказ после передачи покупателю. Статусы «Требует проверки» и «Нужен возврат» требуют сверки с владельцем и платёжным провайдером; не выдавайте такой заказ по одному сообщению покупателя. Список заказов ограничен последними 1000; аналитика считает всю историю базы.",
      ],
      [
        "Маркетинг и права",
        "В «Маркетинге» владелец управляет объявлением, баннером и страницами магазина. При включении объявления или баннера заполните все три языка, используйте внутреннюю ссылку магазина и сохраните изменения. Менеджер может просматривать эти данные. Команда, настройки выдачи и подключения доступны владельцу.",
      ],
      [
        "Проверка результата",
        "После сохранения откройте магазин и проверьте нужный язык, карточку товара и страницы. Кнопка обновления в кабинете загружает свежие данные. При ошибке сохранения исправьте поля и повторите действие; при ошибке аналитики нажмите «Повторить».",
      ],
    ],
    store: "Открыть магазин",
    delivery: "Доставка и оплата",
    returns: "Возврат",
    about: "О магазине",
  },
  kk: {
    title: "Қызметкерге көмек",
    intro: "Urbanmag каталогы және тапсырыстарымен жұмыс тәртібі.",
    sections: [
      [
        "Шолу және талдау",
        "7, 30, 90 немесе 365 күнді таңдаңыз. Түсімге тек толық production-төлемі расталған аяқталған тапсырыстар кіреді. Орындалудағы төленген тапсырыстар бөлек көрсетіледі. Алынып тасталған деректерді «Деректер сапасы» бөлімінен тексеріңіз. Нөл сәйкес жазбалардың жоқтығын білдіреді, төлем қатесін емес.",
      ],
      [
        "Тауарлар және қалдықтар",
        "«Тауарлар» бөлімінде атауы, бренді, мекенжайы немесе санаты бойынша іздеп, «Өзгерту» түймесін басыңыз. Үш тілдегі нұсқаларын толтырыңыз. Сипаттама қосқышы жолды дүкенде жасырып, деректерін сақтайды. Акциялық белгі бағаны өзгертпейді: бағаны бөлек енгізіңіз. Қалдықты өзгерту үшін кестедегі өлшемді басып, филиалды таңдап, санын сақтаңыз.",
      ],
      [
        "Тапсырыстарды өңдеу",
        "«Тапсырыстар» бөлімінде қажетті тапсырысты ашыңыз. Төлем расталған соң өңдеу, алуға дайын және аяқталған күйлеріне кезекпен ауыстырыңыз. Тауарды сатып алушыға бергеннен кейін аяқтаңыз. Тексеру немесе қайтарым қажет күйлерін иесімен және төлем провайдерімен салыстырып тексеріңіз; тек сатып алушы хабарламасына сүйеніп тауарды бермеңіз. Тізім соңғы 1000 тапсырыспен шектелген; талдау базаның бүкіл тарихын есептейді.",
      ],
      [
        "Маркетинг және құқықтар",
        "«Маркетинг» бөлімінде иесі хабарландыруды, баннерді және дүкен беттерін басқарады. Хабарландыруды не баннерді қосқанда үш тілдегі мәтінді толтырып, дүкеннің ішкі сілтемесін қолданыңыз және сақтаңыз. Менеджер деректерді көре алады. Команда, беру параметрлері және қосылымдар тек иесіне қолжетімді.",
      ],
      [
        "Нәтижені тексеру",
        "Сақтаған соң дүкенді ашып, қажетті тілді, тауарды және беттерді тексеріңіз. Кабинеттегі жаңарту түймесі жаңа деректерді жүктейді. Сақтау қатесі болса, өрістерді түзетіп, қайталаңыз; талдау қатесі болса, «Қайталау» түймесін басыңыз.",
      ],
    ],
    store: "Дүкенді ашу",
    delivery: "Жеткізу және төлем",
    returns: "Қайтару",
    about: "Дүкен туралы",
  },
  en: {
    title: "Staff help",
    intro: "How to manage the Urbanmag catalog and orders.",
    sections: [
      [
        "Summary and analytics",
        "Choose 7, 30, 90 or 365 days. Revenue includes only completed orders with verified full production payments. Paid orders awaiting fulfilment are separate. Open Data quality to inspect exclusions. A zero means no qualifying records, not a payment error.",
      ],
      [
        "Products and stock",
        "Open Products, search by name, brand, URL slug or category and choose Edit. Fill in all three languages. A characteristic toggle hides the row in the store while retaining its data. A promotion badge does not change the price: set prices separately. To update stock, select a size in the table, choose a branch and save the quantity.",
      ],
      [
        "Order handling",
        "Open Orders and the relevant order. After confirmed payment, move it through processing, ready for collection and completed. Complete an order after handing it to the customer. Manual review and refund required statuses need reconciliation with the owner and payment provider; a customer message alone is not payment confirmation. The order list contains the latest 1000 orders; analytics uses the entire database history.",
      ],
      [
        "Marketing and permissions",
        "In Marketing, the owner manages announcements, banners and store pages. When enabling an announcement or banner, provide all three translations, use an internal store link and save changes. Managers can view these details. Team, collection settings and integrations are available to the owner.",
      ],
      [
        "Check the result",
        "After saving, open the store and check the language, product and pages. The workspace refresh button loads current data. If saving fails, correct the fields and try again; if analytics fails, select Retry.",
      ],
    ],
    store: "Open store",
    delivery: "Delivery and payment",
    returns: "Returns",
    about: "About",
  },
};
export function StaffHelp({ lang }: { lang: keyof typeof copy }) {
  const t = copy[lang];
  return (
    <section className={s.form}>
      <div>
        <h2>{t.title}</h2>
        <p className={s.fieldHint}>{t.intro}</p>
      </div>
      {t.sections.map(([title, body]) => (
        <article className={s.card} key={title}>
          <h3>{title}</h3>
          <p className={s.helpText}>{body}</p>
        </article>
      ))}
      <nav className={s.helpLinks} aria-label={t.store}>
        {[
          [`/${lang}`, t.store],
          [`/${lang}/delivery`, t.delivery],
          [`/${lang}/returns`, t.returns],
          [`/${lang}/about`, t.about],
        ].map(([href, label]) => (
          <a className={s.button} href={href} key={href}>
            {label} ↗
          </a>
        ))}
      </nav>
    </section>
  );
}
