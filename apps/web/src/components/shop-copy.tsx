export const catalogCopy = {
  ru: {
    loadMore: "Показать ещё",
    shown: (shown: number, total: number) => `Показано ${shown} из ${total}`,
    previousPhoto: "Предыдущее фото",
    nextPhoto: "Следующее фото",
    photo: (index: number) => `Фото ${index}`,
    categories: "Категории",
  },
  kk: {
    loadMore: "Тағы көрсету",
    shown: (shown: number, total: number) =>
      `${total} ішінен ${shown} көрсетілді`,
    previousPhoto: "Алдыңғы сурет",
    nextPhoto: "Келесі сурет",
    photo: (index: number) => `${index}-сурет`,
    categories: "Санаттар",
  },
  en: {
    loadMore: "Show more",
    shown: (shown: number, total: number) => `Showing ${shown} of ${total}`,
    previousPhoto: "Previous photo",
    nextPhoto: "Next photo",
    photo: (index: number) => `Photo ${index}`,
    categories: "Categories",
  },
};
