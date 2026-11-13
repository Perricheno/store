import { getProducts } from '@urbanmag/core';
import { indexingEnabled, shopOrigin } from '@/lib/config';
export const dynamic='force-dynamic';
const xml=(v:string)=>v.replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]!));
export async function GET(){if(!indexingEnabled())return new Response('Not found',{status:404});const origin=shopOrigin();const products=(await getProducts()).filter(p=>!p.isDemo&&p.media.length);
return new Response(`<?xml version="1.0"?><rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>Urbanmag</title><link>${origin}</link><description>Urbanmag</description>${products.map(p=>`<item><g:id>${xml(p.id)}</g:id><title>${xml(p.names.ru)}</title><description>${xml(p.description.ru)}</description><link>${origin}/ru/p/${xml(p.slug)}</link><g:image_link>${xml(new URL(p.media[0],origin).href)}</g:image_link><g:price>${p.price} KZT</g:price><g:availability>${p.sizes.some(v=>v.available>0)?'in_stock':'out_of_stock'}</g:availability><g:condition>new</g:condition><g:brand>${xml(p.brand)}</g:brand></item>`).join('')}</channel></rss>`,{headers:{'Content-Type':'application/xml; charset=utf-8'}});}
