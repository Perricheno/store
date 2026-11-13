import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ApiPay} from './apipay.js';

test('sandbox mode is checked before creating an idempotent whole-tenge invoice', async () => {
  const calls: {url:string, init?:RequestInit}[] = [];
  const request = (async (url: any, init?: RequestInit) => {
    calls.push({url:String(url), init});
    return new Response(JSON.stringify(calls.length === 1 ? {mode:'sandbox'} : {id:123,status:'processing'}), {status:calls.length === 1 ? 200 : 201});
  }) as typeof fetch;
  const api = new ApiPay('sandbox','secret','https://example.test',request);
  assert.deepEqual(await api.create({id:'order-1',phone:'77071234567',total:1500,isDemo:true}), {id:'123',status:'processing'});
  const body = JSON.parse(String(calls[1].init?.body));
  assert.equal(body.amount,1500);
  assert.equal(body.external_order_id_idempotency,'order-1');
  assert.equal(calls[0].url,'https://example.test/account/health');
});
test('wrong account mode blocks invoice creation', async () => {
  let calls = 0;
  const request = (async () => { calls++; return new Response(JSON.stringify({mode:'production'})); }) as typeof fetch;
  const api = new ApiPay('sandbox','key','https://example.test',request);
  await assert.rejects(() => api.create({id:'x',phone:'7',total:1,isDemo:false}));
  assert.equal(calls,1);
});
test('duplicate idempotency response recovers existing invoice', async () => {
  const request = (async (url:any) => String(url).endsWith('/account/health') ? new Response(JSON.stringify({mode:'sandbox'})) : new Response(JSON.stringify({error_code:'duplicate_idempotency_key',invoice_id:7,status:'pending'}),{status:409})) as typeof fetch;
  const api = new ApiPay('sandbox','key','https://example.test',request);
  assert.deepEqual(await api.create({id:'x',phone:'7',total:1,isDemo:false}),{id:'7',status:'pending'});
});
