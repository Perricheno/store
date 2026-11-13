import { publicProduct, type Cart, type Product } from "@urbanmag/core";

export function publicCatalog<T extends { products: Product[] }>(
  catalog: T,
): T {
  return { ...catalog, products: catalog.products.map(publicProduct) };
}

export function publicCart(cart: Cart): Cart {
  return {
    ...cart,
    items: cart.items.map((item) => ({
      ...item,
      product: publicProduct(item.product),
    })),
  };
}
