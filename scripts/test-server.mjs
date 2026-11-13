import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();const data=path.join(root,'.data','e2e',String(Date.now()));await mkdir(data,{recursive:true});
const env={...process.env,APP_ENV:'test',APIPAY_MODE:'mock',DATABASE_URL:'',APP_URL:'http://localhost:3100',STAFF_URL:'http://localhost:3100',PGLITE_DATA_DIR:path.join(data,'pg'),TEST_MAIL_DIR:path.join(root,'.data','e2e','mail'),MAIL_ENCRYPTION_KEY:randomBytes(32).toString('hex'),APP_SECRET:randomBytes(32).toString('hex'),BOOTSTRAP_OWNER_EMAIL:'owner@urbanmag.test',BOOTSTRAP_OWNER_PASSWORD:'E2e-owner-password-2026!',UPLOADS_DIR:path.join(data,'uploads')};
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','apps/web','--hostname','127.0.0.1','--port','3100'],{env,stdio:'inherit'});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));child.on('exit',code=>process.exit(code??1));
