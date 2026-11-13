import {notFound} from 'next/navigation';
import {getProducts,getSettings} from '@urbanmag/core';
import {Storefront} from '@/components/shop';
import {isLocale} from '@/lib/config';
import {pageMetadata} from '@/lib/seo';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{locale:string,slug:string}>}){const {locale,slug}=await params;if(!isLocale(locale))return {};return pageMetadata(locale,slug,'Urbanmag',`/c/${slug}`);}
export default async function Page({params}:{params:Promise<{locale:string,slug:string}>}){const {locale,slug}=await params;if(!isLocale(locale))notFound();const products=await getProducts({category:slug});if(!products.length)notFound();return <Storefront locale={locale} products={products} settings={await getSettings()}/>;}
