import type { MetadataRoute } from "next";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const staff = (await headers()).get("x-urbanmag-zone") === "staff";
  return {
    name: staff ? "Urbanmag · Команда" : "Urbanmag",
    short_name: staff ? "Urbanmag Team" : "Urbanmag",
    start_url: staff ? "/staff" : "/ru",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#e60012",
    icons: [
      {
        src: "/icons/urbanmag-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/urbanmag-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/urbanmag-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
