import { createServer } from '../frontend/node_modules/vite/dist/node/index.js';
import { chromium } from '../frontend/node_modules/playwright/index.mjs';
import path from 'node:path';
const root=path.resolve('.');
const server=await createServer({configFile:path.join(root,'frontend/vite.config.ts'),root:path.join(root,'frontend'),appType:'custom',server:{host:'127.0.0.1',port:5179,strictPort:true,fs:{allow:[root]}}});
server.middlewares.use(async(req,res,next)=>{if(req.url!=='/__launch.html')return next();const html=await server.transformIndexHtml('/__launch.html',`<!doctype html><html><head><meta charset="utf-8"><style>*{animation:none!important;transition:none!important}</style></head><body><div id="root"></div><script type="module" src="/@fs/${path.join(root,'scripts/launch-report-capture.tsx').replaceAll('\\','/')}"></script></body></html>`);res.setHeader('Content-Type','text/html');res.end(html)});
await server.listen();const browser=await chromium.launch({channel:'chrome',headless:true});
try{const page=await browser.newPage({viewport:{width:1280,height:1050},deviceScaleFactor:2});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5179/__launch.html',{waitUntil:'domcontentloaded'});await page.getByText('Chọn chủ đề Design Thinking',{exact:true}).waitFor();await page.getByRole('dialog').screenshot({path:path.join(root,'artifacts/videos/launch-assets/report.png')});console.log('Captured project ExportSummaryModal with product-story fixture.',errors);}finally{await browser.close();await server.close();}
