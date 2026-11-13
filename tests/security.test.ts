import {test} from 'node:test';
import assert from 'node:assert/strict';
import {indexingEnabled} from '../apps/web/src/lib/config';
test('indexing gate keeps temporary domains and non-production out of search',()=>{
 const old={...process.env};try{
 process.env.SEO_INDEXING_ENABLED='true';process.env.APP_ENV='production';process.env.APP_URL='https://u.perricheno.com';assert.equal(indexingEnabled(),false);
 process.env.APP_URL='https://urbanmag.example';assert.equal(indexingEnabled(),true);
 process.env.APP_ENV='development';assert.equal(indexingEnabled(),false);
 process.env.APP_ENV='production';process.env.SEO_INDEXING_ENABLED='false';assert.equal(indexingEnabled(),false);
 }finally{for(const key of ['APP_URL','APP_ENV','SEO_INDEXING_ENABLED']){if(old[key]===undefined)delete process.env[key];else process.env[key]=old[key];}}
});
