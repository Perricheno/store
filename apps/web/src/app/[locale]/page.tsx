import { notFound } from 'next/navigation';
import { getProducts, getSettings } from '@urbanmag/core';
import { Storefront } from '@/components/shop';
import { isLocale } from '@/lib/config';
import { pageMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export async function generateMetadata({params}:{params:Promise<{locale:string}>}) {
  const {locale}=await params; if(!isLocale(locale))return {};
  const titles={ru:'Одежда и кроссовки',kk:'Киім және кроссовкалар',en:'Clothing & sneakers'};
  const descriptions={ru:'Каталог Urbanmag. Одежда и кроссовки, самовывоз в Жезказгане.',kk:'Urbanmag каталогы. Киім мен кроссовкалар, Жезқазғанда алып кету.',en:'The Urbanmag catalog. Clothing and sneakers, pickup in Zhezkazgan.'};
  return pageMetadata(locale,titles[locale],descriptions[locale]);
}
export default async function Catalog({params}:{params:Promise<{locale:string}>}) {
  const {locale}=await params;if(!isLocale(locale))notFound();
  const [products,settings]=await Promise.all([getProducts(),getSettings()]);
  return <Storefront locale={locale} products={products} settings={settings}/>;
}
