import type { Metadata, Viewport } from "next";
import "./globals.css";
import { headers } from "next/headers";
import localFont from "next/font/local";
import { IconProvider } from "@/components/icon-provider";

// Keep Unicode subsets in one family while Next emits/preloads their local assets.
// Tenge needs one glyph, rather than downloading the full Latin Extended subset.
const inter = localFont({
  src: "../../public/fonts/inter-latin-wght-normal.woff2",
  variable: "--font-inter",
  weight: "100 900",
  style: "normal",
  display: "swap",
  preload: true,
  declarations: [
    { prop: "font-family", value: "Inter Variable" },
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD",
    },
  ],
});
const interCyrillic = localFont({
  src: "../../public/fonts/inter-cyrillic-wght-normal.woff2",
  variable: "--font-inter-cyrillic",
  weight: "100 900",
  style: "normal",
  display: "swap",
  preload: true,
  adjustFontFallback: false,
  declarations: [
    { prop: "font-family", value: "Inter Variable" },
    {
      prop: "unicode-range",
      value: "U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116",
    },
  ],
});
const interCyrillicExtended = localFont({
  src: "../../public/fonts/inter-cyrillic-ext-wght-normal.woff2",
  variable: "--font-inter-cyrillic-extended",
  weight: "100 900",
  style: "normal",
  display: "swap",
  preload: true,
  adjustFontFallback: false,
  declarations: [
    { prop: "font-family", value: "Inter Variable" },
    {
      prop: "unicode-range",
      value:
        "U+0460-052F,U+1C80-1C8A,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F",
    },
  ],
});
const interCurrency = localFont({
  src: "../../public/fonts/inter-currency-wght-normal.woff2",
  variable: "--font-inter-currency",
  weight: "100 900",
  style: "normal",
  display: "swap",
  preload: true,
  adjustFontFallback: false,
  declarations: [
    { prop: "font-family", value: "Inter Variable" },
    { prop: "unicode-range", value: "U+20B8" },
  ],
});

export const metadata: Metadata = {
  title: {
    default: "Urbanmag — одежда и кроссовки",
    template: "%s — Urbanmag",
  },
  description: "Одежда и кроссовки Urbanmag. Самовывоз в Жезказгане.",
  robots: { index: false, follow: true },
  verification: { google: process.env.GOOGLE_SITE_VERIFICATION || undefined },
  appleWebApp: { capable: true, title: "Urbanmag", statusBarStyle: "default" },
  icons: { apple: "/icons/urbanmag-192.png" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = (await headers()).get("x-urbanmag-locale") || "ru";
  return (
    <html
      lang={locale}
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${interCyrillic.variable} ${interCyrillicExtended.variable} ${interCurrency.variable}`}
    >
      <body>
        <IconProvider>{children}</IconProvider>
      </body>
    </html>
  );
}
