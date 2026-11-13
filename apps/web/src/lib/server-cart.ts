import { cookies } from "next/headers";
import { getCart, type Cart } from "@urbanmag/core";
import { cookieName } from "./http";
import { publicCart } from "./public-catalog";

// Server Components can read the visitor cookie, but must never create one.
// Keep the lookup request scoped: carts must not enter a shared cache.
export async function initialCart(): Promise<Cart> {
  const visitor = (await cookies()).get(await cookieName("visitor"))?.value;
  if (
    !visitor ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
      visitor,
    )
  )
    return { items: [], total: 0, count: 0 };
  return publicCart(await getCart(visitor));
}
