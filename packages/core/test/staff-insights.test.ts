import test, { after } from "node:test";
import assert from "node:assert/strict";
process.env.DATABASE_URL = "";
process.env.PGLITE_DATA_DIR = "memory://";
process.env.APP_ENV = "test";
process.env.APIPAY_MODE = "mock";
const core = await import("../src/index");
const { database } = await import("../src/db");
after(() => core.closeCore());

test("staff insights use verified history, complete SQL counts and Almaty boundaries", async () => {
 await core.initCore();
 const db = await database();
 for (const [id,role,rotate] of [["ins-owner","owner",false],["ins-manager","manager",false],["ins-customer","customer",false],["ins-rotate","manager",true]] as const)
  await db.query("INSERT INTO users(id,email,role,must_change_password) VALUES($1,$2,$3,$4)",[id,`${id}@example.test`,role,rotate]);
 for (const id of ["ins-customer","missing"]) await assert.rejects(core.getStaffInsights(id),{code:"FORBIDDEN"});
 await assert.rejects(core.getStaffInsights("ins-rotate"),{code:"PASSWORD_CHANGE_REQUIRED"});
 for (const days of [0,1,8,31,NaN]) await assert.rejects(core.getStaffInsights("ins-owner",{days}),{code:"VALIDATION"});
 await db.query(`INSERT INTO orders(id,visitor_id,email,phone,locale,status,total,lines,idempotency_key,request_hash,access_token_hash,expires_at,created_at)
 SELECT 'ins-'||n,'ins-visitor','buyer@example.test','test','ru',CASE WHEN n<=8 THEN 'completed' ELSE 'awaiting_payment' END,100,
 jsonb_build_array(jsonb_build_object('productId','legacy-product','names',jsonb_build_object('ru','История','kk','Тарих','en','History'),'price',100,'quantity',1,'isDemo',n=3)),
 'key-'||n,'hash','hash',now()+interval '1 day',now()-interval '1 minute' FROM generate_series(1,1005) n`);
 await db.query(`INSERT INTO payments(id,order_id,amount,environment,status)
 SELECT 'payment-'||n,'ins-'||n,CASE WHEN n=8 THEN 99 ELSE 100 END,CASE WHEN n=4 THEN 'sandbox' ELSE 'production' END,
 CASE WHEN n=5 THEN 'partially_refunded' WHEN n=6 THEN 'refunded' ELSE 'paid' END FROM generate_series(1,8) n`);
 await db.query(`INSERT INTO payment_events(event_id,order_id,event_type,payload) SELECT 'event-'||n,'ins-'||n,'paid','{}' FROM generate_series(1,8) n WHERE n<>7`);
 // Duplicate accepted paid events must not multiply totals.
 await db.query("INSERT INTO payment_events(event_id,order_id,event_type,payload) VALUES('event-again','ins-1','paid','{}')");
 await db.query(`INSERT INTO audit(id,action,entity_id,details,created_at)
 SELECT 'audit-'||n,'order.status','ins-'||n,'{"to":"completed"}',
 CASE WHEN n=2 THEN (((now() AT TIME ZONE 'Asia/Almaty')::date-6)::timestamp AT TIME ZONE 'Asia/Almaty')-interval '1 microsecond' ELSE now()-interval '1 minute' END
 FROM generate_series(1,8) n`);
 await db.query("INSERT INTO products(id,slug,category,gender,brand,names,description,price,published) VALUES('ins-product','ins-product','hoodies','unisex','Test','{\"ru\":\"Товар\",\"kk\":\"Тауар\",\"en\":\"Product\"}','{}',100,true)");
 await db.query("INSERT INTO variants(id,product_id,size,color) VALUES('ins-low','ins-product','S','Black'),('ins-out','ins-product','M','Black')");
 await db.query("INSERT INTO inventory(variant_id,branch_id,quantity,reserved) VALUES('ins-low','one',4,3),('ins-low','two',1,0)");
 const result=await core.getStaffInsights("ins-owner",{days:7});
 assert.equal(result.inventory.lowVariants,1);
 assert.equal(result.inventory.outVariants,1);
 assert.equal(result.inventory.availableUnits,2);
 assert.equal(result.inventory.reservedUnits,3);
 assert.equal(result.inventory.alerts.length,2);
 assert.equal(result.orders.created,1005);
 assert.equal(result.quality.allOrders,1005);
 assert.equal(result.quality.demoOrders,1);
 assert.equal(result.quality.sandboxOrders,1);
 assert.equal(result.quality.partialRefundOrders,1);
 assert.equal(result.revenue.completedOrders,1);
 assert.equal(result.revenue.completedAmount,100);
 assert.equal(result.daily.length,7);
 assert.equal(result.daily.reduce((n,d)=>n+d.completedAmount,0),100);
 assert.deepEqual(result.categorySales,[{category:null,units:1,amount:100}]);
 assert.equal(result.topProducts[0]?.units,1);
 assert.equal(result.quality.linesWithoutCategory,1);
 assert.equal(new Date(result.period.from).getUTCHours(),19);
 const manager=await core.getStaffInsights("ins-manager",{days:30});
 assert.equal(manager.revenue.completedAmount,200);
 assert.equal(manager.daily.length,30);
 for(const days of [90,365] as const) assert.equal((await core.getStaffInsights("ins-owner",{days})).daily.length,days);
});
