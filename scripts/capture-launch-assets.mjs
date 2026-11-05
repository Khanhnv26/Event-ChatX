import { chromium } from '../frontend/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const out=path.resolve('artifacts/videos/launch-assets');await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:960},deviceScaleFactor:2});
 await page.goto('http://127.0.0.1:18082/rooms/cm5j-see',{waitUntil:'domcontentloaded'});
 await page.getByLabel('Biệt danh của bạn').fill('Khánh');await page.getByRole('button',{name:'Vào phòng ngay'}).click();
 await page.locator('input[placeholder="Nhập tin nhắn thảo luận..."]').waitFor();
 if(!await page.locator('html').evaluate(el=>el.classList.contains('dark')))await page.locator('button[aria-label="Toggle theme"]').click();
 await page.getByText('Mô hình kiến trúc nào tối ưu nhất cho MVP?',{exact:true}).first().waitFor();
 await page.addStyleTag({content:'*{animation:none!important;transition:none!important}'});
 // Adapt only demo copy for this presentation. Component markup and product CSS remain intact.
 const adapt=()=>page.evaluate(()=>{
  const replacements=[['Workshop: Kiến trúc Modular Monolith & Living Tools','Workshop sáng tạo'],['Mô hình kiến trúc nào tối ưu nhất cho MVP?','Chủ đề workshop tiếp theo?'],['Modular Monolith (Triển khai 1 container)','Design Thinking'],['Microservices độc lập (K8s)','Kỹ năng thuyết trình'],['Chào mừng các bạn đã đến với buổi Workshop EventChat hôm nay! 🎉','Mọi người chọn chủ đề workshop nhé.'],['Chào anh Alex! Em rất mong chờ trải nghiệm bộ công cụ Living Tools hôm nay.','Mình đề xuất Design Thinking!'],['Cho em hỏi về kiến trúc Modular Monolith và Spring Boot 3 với ạ?','Cùng bình chọn để chốt nhé!'],['Lựa chọn ngẫu nhiên: Mai Linh (Kỹ sư phần mềm)','Chọn chủ đề Design Thinking'],['Mai Linh (Kỹ sư phần mềm)','Mai Linh']];
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);for(let n=walker.nextNode();n;n=walker.nextNode()){if(n.parentElement?.closest('script,style'))continue;let value=n.nodeValue;for(const [from,to] of replacements)value=value.replaceAll(from,to);if(value!==n.nodeValue)n.nodeValue=value;}
 });
 await adapt();await page.screenshot({path:path.join(out,'workspace.png')});
 await page.getByText('Chủ đề workshop tiếp theo?',{exact:true}).first().locator('xpath=ancestor::section[1]').screenshot({path:path.join(out,'poll.png')});
 const messages=['Mọi người chọn chủ đề workshop nhé.','Mình đề xuất Design Thinking!','Cùng bình chọn để chốt nhé!'];
 for(const [index,text] of messages.entries()){
  const el=page.getByText(text,{exact:true}).first();
  // The product's bubble and its original author/timestamp row are captured together.
  await el.locator('xpath=ancestor::*[contains(@class,"chat-message")][1]').screenshot({path:path.join(out,`chat-${index+1}.png`)});
 }
 await page.getByText('Chọn chủ đề Design Thinking',{exact:true}).first().locator('xpath=ancestor::*[contains(@class,"border")][1]').screenshot({path:path.join(out,'decision.png')});
 await writeFile(path.join(out,'provenance.json'),JSON.stringify({capturedAt:new Date().toISOString(),deviceScaleFactor:2,source:'Actual EventChat UI components; demo copy adapted in the capture DOM for this product film. No product source or stored room content changed.'},null,2));
 console.log('Captured 6 real project UI assets at 2× pixel density. Run capture-launch-report.mjs for the report component.');
}finally{await browser.close();}
