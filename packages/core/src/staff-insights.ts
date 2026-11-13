import type { DB } from "./db";
import type { StaffInsights } from "./types";

/** One statement gives every aggregate the same database snapshot. */
export async function queryStaffInsights(
  db: DB,
  days: 7 | 30 | 90 | 365,
): Promise<StaffInsights> {
  const [row] = await db.query(
    `
WITH bounds AS (
 SELECT now() AS until, ((now() AT TIME ZONE 'Asia/Almaty')::date - ($1::int - 1))::timestamp AT TIME ZONE 'Asia/Almaty' AS since
), history AS (
 SELECT entity_id, min(created_at) AS completed_at FROM audit
 WHERE action='order.status' AND details->>'to'='completed' GROUP BY entity_id
), base AS (
 SELECT o.*, p.status AS payment_status, p.environment, h.completed_at,
   (jsonb_array_length(o.lines)>0 AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(o.lines) l WHERE l->>'isDemo' IS DISTINCT FROM 'false')) AS real_lines,
   (p.status='paid' AND p.environment='production' AND p.amount=o.total AND (
     (p.method='apipay' AND EXISTS (SELECT 1 FROM payment_events e WHERE e.order_id=o.id AND e.event_type='paid'))
     OR (p.method='wallet' AND EXISTS (
       SELECT 1 FROM wallet_entries e WHERE e.order_id=o.id AND e.kind='order_debit'
       AND e.user_id=o.user_id AND e.environment=p.environment AND e.amount=o.total
     ) AND NOT EXISTS (SELECT 1 FROM wallet_entries e WHERE e.order_id=o.id AND e.kind='order_refund'))
   )) AS verified
 FROM orders o LEFT JOIN payments p ON p.order_id=o.id LEFT JOIN history h ON h.entity_id=o.id
), completed AS (
 SELECT b.* FROM base b, bounds t WHERE b.real_lines AND b.verified AND b.status='completed' AND b.completed_at>=t.since AND b.completed_at<t.until
), created AS (
 SELECT b.* FROM base b,bounds t WHERE b.created_at>=t.since AND b.created_at<t.until
), sold AS (
 SELECT l FROM completed c CROSS JOIN LATERAL jsonb_array_elements(c.lines) l
), variant_stock AS (
 SELECT v.id,v.product_id,p.names,v.size,v.color,coalesce(sum(i.quantity-i.reserved),0)::int AS available,
 coalesce(sum(i.reserved),0)::int AS reserved
 FROM variants v JOIN products p ON p.id=v.product_id LEFT JOIN inventory i ON i.variant_id=v.id
 WHERE NOT p.is_demo AND p.published GROUP BY v.id,v.product_id,p.names,v.size,v.color
), dates AS (
 SELECT d::date AS day FROM bounds t, LATERAL generate_series((t.since AT TIME ZONE 'Asia/Almaty')::date,(t.until AT TIME ZONE 'Asia/Almaty')::date,interval '1 day') d
), product_sales AS (
 SELECT l->>'productId' AS id,(jsonb_agg(l->'names')->0) AS names,sum((l->>'quantity')::bigint) AS units,sum((l->>'quantity')::bigint*(l->>'price')::bigint) AS amount FROM sold GROUP BY l->>'productId'
), category_sales AS (
 SELECT nullif(l->>'category','') AS category,sum((l->>'quantity')::bigint) AS units,sum((l->>'quantity')::bigint*(l->>'price')::bigint) AS amount FROM sold GROUP BY nullif(l->>'category','')
)
SELECT jsonb_build_object(
 'generatedAt',t.until,'period',jsonb_build_object('days',$1::int,'from',t.since,'to',t.until,'timezone','Asia/Almaty'),
 'revenue',(SELECT jsonb_build_object('completedAmount',coalesce(sum(total),0),'completedOrders',count(*),'averageCompletedOrder',round(avg(total))) FROM completed),
 'pipeline',(SELECT jsonb_build_object('paidAmount',coalesce(sum(total),0),'paidOrders',count(*)) FROM base WHERE real_lines AND verified AND status IN ('paid','processing','ready')),
 'orders',jsonb_build_object('created',(SELECT count(*) FROM created),'byStatus',coalesce((SELECT jsonb_object_agg(status,n) FROM (SELECT status,count(*) n FROM created GROUP BY status) x),'{}'::jsonb)),
 'catalog',(SELECT jsonb_build_object('realProducts',count(*) FILTER(WHERE NOT is_demo),'demoProducts',count(*) FILTER(WHERE is_demo),'publishedRealProducts',count(*) FILTER(WHERE NOT is_demo AND published)) FROM products),
 'inventory',(SELECT jsonb_build_object('availableUnits',coalesce(sum(available),0),'reservedUnits',coalesce(sum(reserved),0),'lowVariants',count(*) FILTER(WHERE available BETWEEN 1 AND 3),'outVariants',count(*) FILTER(WHERE available=0),'alerts',coalesce((SELECT jsonb_agg(jsonb_build_object('variantId',id,'productId',product_id,'names',names,'size',size,'color',color,'available',available) ORDER BY available,id) FROM (SELECT * FROM variant_stock WHERE available<=3 ORDER BY available,id LIMIT 20) a),'[]'::jsonb)) FROM variant_stock),
 'daily',(SELECT jsonb_agg(jsonb_build_object('date',day,'createdOrders',(SELECT count(*) FROM created c WHERE (c.created_at AT TIME ZONE 'Asia/Almaty')::date=day),'completedOrders',(SELECT count(*) FROM completed c WHERE (c.completed_at AT TIME ZONE 'Asia/Almaty')::date=day),'completedAmount',(SELECT coalesce(sum(total),0) FROM completed c WHERE (c.completed_at AT TIME ZONE 'Asia/Almaty')::date=day)) ORDER BY day) FROM dates),
 'topProducts',coalesce((SELECT jsonb_agg(jsonb_build_object('productId',id,'names',names,'units',units,'amount',amount) ORDER BY amount DESC,id) FROM (SELECT * FROM product_sales ORDER BY amount DESC,id LIMIT 10) p),'[]'::jsonb),
 'categorySales',coalesce((SELECT jsonb_agg(jsonb_build_object('category',category,'units',units,'amount',amount) ORDER BY amount DESC,category) FROM category_sales),'[]'::jsonb),
 'quality',(SELECT jsonb_build_object('allOrders',count(*),'verifiedRealOrders',count(*) FILTER(WHERE real_lines AND verified),'demoOrders',count(*) FILTER(WHERE NOT real_lines),'sandboxOrders',count(*) FILTER(WHERE environment IN ('sandbox','mock')),'unverifiedOrders',count(*) FILTER(WHERE NOT coalesce(verified,false)),'completedWithoutTimestamp',count(*) FILTER(WHERE status='completed' AND completed_at IS NULL),'linesWithoutCategory',(SELECT count(*) FROM sold WHERE nullif(l->>'category','') IS NULL),'partialRefundOrders',count(*) FILTER(WHERE payment_status='partially_refunded')) FROM base)
) AS insights FROM bounds t`,
    [days],
  );
  return row.insights as StaffInsights;
}
