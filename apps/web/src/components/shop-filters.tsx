"use client";

import { useId, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  CoatHanger,
  MagnifyingGlass,
  SlidersHorizontal,
  SquaresFour,
  X,
} from "@phosphor-icons/react";
import { CATEGORIES, categoryName, type CatalogFilterState } from "../lib/categories";
import {
  catalogRefinementCount,
  clearCatalogRefinements,
  validCatalogPriceRange,
} from "../lib/catalog-filter-controls";
import { categoryIcons } from "../lib/category-icons";
import { dictionary, money, type Locale } from "../lib/i18n";
import { catalogCopy } from "./shop-copy";
import s from "./shop-filters.module.css";

const copy = {
  ru: {
    audience: "Для кого",
    everyone: "Всем",
    clothing: "Одежда",
    shoes: "Обувь",
    oneSize: "Единый размер",
    selected: "Выбранные фильтры",
    remove: (name: string) => `Убрать: ${name}`,
    invalidPrice: "Цена «От» должна быть не больше цены «До».",
    invalidNumber: "Укажите цену от 0 ₸.",
  },
  kk: {
    audience: "Кімге",
    everyone: "Барлығына",
    clothing: "Киім",
    shoes: "Аяқкиім",
    oneSize: "Бірыңғай өлшем",
    selected: "Таңдалған сүзгілер",
    remove: (name: string) => `Алып тастау: ${name}`,
    invalidPrice: "Бастапқы баға соңғы бағадан аспауы керек.",
    invalidNumber: "Бағаны 0 ₸ бастап енгізіңіз.",
  },
  en: {
    audience: "Shop for",
    everyone: "Everyone",
    clothing: "Clothing",
    shoes: "Shoes",
    oneSize: "One size",
    selected: "Selected filters",
    remove: (name: string) => `Remove: ${name}`,
    invalidPrice: "The minimum price must not exceed the maximum.",
    invalidNumber: "Enter a price of 0 ₸ or more.",
  },
};
const clothingSizes = ["XS", "S", "M", "L", "XL", "XXL"];
const shoeSizes = Array.from({ length: 11 }, (_, index) => String(index + 36));

export function ShopFilters({
  locale,
  filters,
  total,
  loading,
  onChange,
}: {
  locale: Locale;
  filters: CatalogFilterState;
  total: number;
  loading: boolean;
  onChange: (filters: CatalogFilterState, search?: boolean) => void;
}) {
  const t = dictionary(locale), c = copy[locale];
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(filters);
  const [priceError, setPriceError] = useState(false);
  const count = catalogRefinementCount(filters);
  const audiences = [["", c.everyone], ["men", t.men], ["women", t.women]];
  const update = <K extends keyof CatalogFilterState>(key: K, value: CatalogFilterState[K]) => {
    setPriceError(false);
    setDraft((previous) => ({ ...previous, [key]: value }));
  };
  const chips: { label: string; remove: () => void }[] = [];
  if (filters.gender) chips.push({
    label: filters.gender === "men" ? t.men : t.women,
    remove: () => onChange({ ...filters, gender: "" }),
  });
  if (filters.category !== "all") chips.push({
    label: categoryName(locale, filters.category) || filters.category,
    remove: () => onChange({ ...filters, category: "all" }),
  });
  if (filters.size) chips.push({
    label: `${t.size}: ${filters.size === "ONE SIZE" ? c.oneSize : filters.size}`,
    remove: () => onChange({ ...filters, size: "" }),
  });
  if (filters.minPrice !== "" || filters.maxPrice !== "") chips.push({
    label: `${filters.minPrice !== "" ? `${t.from} ${money(Number(filters.minPrice), locale)}` : ""}${filters.minPrice !== "" && filters.maxPrice !== "" ? " · " : ""}${filters.maxPrice !== "" ? `${t.to} ${money(Number(filters.maxPrice), locale)}` : ""}`,
    remove: () => onChange({ ...filters, minPrice: "", maxPrice: "" }),
  });
  if (filters.available) chips.push({ label: t.available, remove: () => onChange({ ...filters, available: false }) });

  function open() {
    setDraft(filters);
    setPriceError(false);
    dialog.current?.showModal();
  }
  function apply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validCatalogPriceRange(draft)) {
      setPriceError(true);
      dialog.current?.querySelector<HTMLInputElement>('input[name="minPrice"]')?.focus();
      return;
    }
    // Search and ordering stay current even if another control updates them.
    onChange({ ...draft, q: filters.q, sort: filters.sort });
    dialog.current?.close();
  }
  function sizeOptions(values: string[]) {
    return values.map((value) => (
      <button type="button" key={value} className={`${s.size} ${draft.size === value ? s.chosen : ""}`} aria-pressed={draft.size === value} onClick={() => update("size", draft.size === value ? "" : value)}>
        {value === "ONE SIZE" ? c.oneSize : value}
      </button>
    ));
  }

  return (
    <div className={s.filters}>
      <div className={s.audiences} role="group" aria-label={c.audience}>
        {audiences.map(([value, label]) => (
          <button type="button" key={value} aria-pressed={filters.gender === value} className={filters.gender === value ? s.audienceSelected : ""} onClick={() => onChange({ ...filters, gender: value })}>{label}</button>
        ))}
      </div>
      <nav className={s.categories} aria-label={catalogCopy[locale].categories}>
        <button type="button" aria-pressed={filters.category === "all"} className={filters.category === "all" ? s.categorySelected : ""} onClick={() => onChange({ ...filters, category: "all" })}>
          <SquaresFour size={19} weight="bold" aria-hidden="true" />{t.all}
        </button>
        {CATEGORIES.map((category) => {
          const Icon = categoryIcons[category.id] || CoatHanger;
          return <button type="button" key={category.id} aria-pressed={filters.category === category.id} className={filters.category === category.id ? s.categorySelected : ""} onClick={() => onChange({ ...filters, category: category.id })}>
            <Icon size={19} weight="bold" aria-hidden="true" />{category.names[locale]}
          </button>;
        })}
      </nav>
      <div className={s.toolbar}>
        <form className={s.search} role="search" onSubmit={(event) => event.preventDefault()}>
          <MagnifyingGlass size={19} weight="bold" aria-hidden="true" />
          <input type="search" aria-label={t.search} placeholder={t.searchPlaceholder} value={filters.q} maxLength={200} onChange={(event) => onChange({ ...filters, q: event.target.value }, true)} />
          {filters.q && <button type="button" aria-label={c.remove(t.search)} onClick={() => onChange({ ...filters, q: "" })}><X size={18} aria-hidden="true" /></button>}
        </form>
        <button type="button" className={s.trigger} aria-haspopup="dialog" aria-controls={`${id}-dialog`} onClick={open}>
          <SlidersHorizontal size={19} weight="bold" aria-hidden="true" />{t.filters}{count > 0 && <span className={s.badge}>{count}</span>}
        </button>
        <label className={s.sort}>
          <span className={s.srOnly}>{t.sort}</span>
          <select value={filters.sort} onChange={(event) => onChange({ ...filters, sort: event.target.value })}>
            <option value="newest">{t.newest}</option><option value="price-asc">{t.priceAsc}</option><option value="price-desc">{t.priceDesc}</option>
          </select>
        </label>
      </div>
      <div className={s.summary}>
        <span className={s.count} aria-live="polite">{loading ? t.loading : `${total} ${t.pieces}`}</span>
        {chips.length > 0 && <div className={s.chips} role="group" aria-label={c.selected}>
          {chips.map((chip) => <button type="button" key={chip.label} onClick={chip.remove} aria-label={c.remove(chip.label)}>{chip.label}<X size={14} aria-hidden="true" /></button>)}
          <button type="button" className={s.clearAll} onClick={() => onChange(clearCatalogRefinements(filters))}>{t.reset}</button>
        </div>}
      </div>
      <dialog ref={dialog} id={`${id}-dialog`} className={s.dialog} aria-labelledby={`${id}-title`} onClick={(event) => {
        if (event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect();
          if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.current?.close();
        }
      }}>
        <form className={s.panel} onSubmit={apply} noValidate>
          <div className={s.header}>
            <h2 id={`${id}-title`}>{t.filters}<span className={s.draftCount}>{catalogRefinementCount(draft)}</span></h2>
            <button autoFocus type="button" className={s.close} aria-label={t.close} onClick={() => dialog.current?.close()}><X size={22} weight="bold" aria-hidden="true" /></button>
          </div>
          <div className={s.body} data-testid="filter-scroll">
            <fieldset className={s.group}><legend>{c.audience}</legend>
              <div className={s.segments}>{audiences.map(([value, label]) => <button type="button" key={value} aria-pressed={draft.gender === value} className={draft.gender === value ? s.chosen : ""} onClick={() => update("gender", value)}>{label}</button>)}</div>
            </fieldset>
            <fieldset className={s.group}><legend>{catalogCopy[locale].categories}</legend>
              <select className={s.categorySelect} aria-label={catalogCopy[locale].categories} value={draft.category} onChange={(event) => update("category", event.target.value)}>
                <option value="all">{t.all}</option>{CATEGORIES.map((category) => <option key={category.id} value={category.id}>{category.names[locale]}</option>)}
              </select>
            </fieldset>
            <fieldset className={s.group}><legend>{t.size}</legend>
              <p className={s.sublabel}>{c.clothing}</p><div className={s.sizes}>{sizeOptions(clothingSizes)}</div>
              <p className={s.sublabel}>{c.shoes}</p><div className={s.sizes}>{sizeOptions(shoeSizes)}</div>
              <div className={s.otherSize}>{sizeOptions(["ONE SIZE", ...(![...clothingSizes, ...shoeSizes, "ONE SIZE", ""].includes(draft.size) ? [draft.size] : [])])}</div>
            </fieldset>
            <fieldset className={s.group}><legend>{t.price}</legend>
              <div className={s.prices}>
                <label>{t.from}<input name="minPrice" type="number" min="0" step="any" inputMode="decimal" placeholder="0" value={draft.minPrice} aria-invalid={priceError || undefined} aria-describedby={priceError ? `${id}-price-error` : undefined} onChange={(event) => update("minPrice", event.target.value)} /></label>
                <span aria-hidden="true">—</span>
                <label>{t.to}<input name="maxPrice" type="number" min="0" step="any" inputMode="decimal" placeholder="∞" value={draft.maxPrice} aria-invalid={priceError || undefined} aria-describedby={priceError ? `${id}-price-error` : undefined} onChange={(event) => update("maxPrice", event.target.value)} /></label>
              </div>
              {priceError && <p className={s.error} id={`${id}-price-error`} role="alert">{Number(draft.minPrice) < 0 || Number(draft.maxPrice) < 0 ? c.invalidNumber : c.invalidPrice}</p>}
            </fieldset>
            <label className={s.availability}>
              <span>{t.available}</span><input type="checkbox" checked={draft.available} onChange={(event) => update("available", event.target.checked)} /><span className={s.toggle} aria-hidden="true"><Check size={14} weight="bold" /></span>
            </label>
          </div>
          <div className={s.footer}>
            <button type="button" className={s.reset} onClick={() => { setDraft(clearCatalogRefinements(draft)); setPriceError(false); }}>{t.reset}</button>
            <button type="submit" className={s.apply}>{t.apply}<ArrowRight size={19} weight="bold" aria-hidden="true" /></button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
