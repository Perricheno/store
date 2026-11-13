import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/e2e',fullyParallel:false,workers:1,timeout:60000,
  expect:{timeout:15000},retries:0,reporter:[['list'],['html',{open:'never'}]],
  use:{baseURL:'http://localhost:3100',trace:'retain-on-failure',screenshot:'only-on-failure',launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined}},
  projects:[{name:'chromium',use:{...devices['Desktop Chrome']}}],
  webServer:{command:'node scripts/test-server.mjs',url:'http://localhost:3100/api/health',reuseExistingServer:false,timeout:120000},
});
