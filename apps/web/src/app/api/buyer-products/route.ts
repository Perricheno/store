import { getPublishedProductsBySlugs, publicProduct } from "@urbanmag/core";
import { HISTORY_LIMIT } from "@/lib/buyer-device";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const slugs = [
    ...new Set(new URL(request.url).searchParams.getAll("slug")),
  ].slice(0, HISTORY_LIMIT);
  if (slugs.some((slug) => !/^[a-z0-9][a-z0-9-]{0,199}$/.test(slug)))
    return Response.json({ products: [] }, { status: 400 });
  const products = await getPublishedProductsBySlugs(slugs);
  return Response.json(
    { products: products.map(publicProduct) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
