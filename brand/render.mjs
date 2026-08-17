import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, readdirSync } from "node:fs";
function chromium(){const bases=[join(process.cwd(),"apps/extension/node_modules")];const c=join(homedir(),".npm","_npx");if(existsSync(c))for(const e of readdirSync(c))bases.push(join(c,e,"node_modules"));for(const b of bases){try{return createRequire(join(b,"n.js"))("playwright").chromium}catch{}}throw new Error("no playwright")}
const [,,html,out,size]=process.argv;
const b=await chromium().launch();
const p=await b.newPage({viewport:{width:+size,height:+size},deviceScaleFactor:1});
await p.goto(`file://${html}`);
await p.evaluate(()=>document.fonts.ready);
await p.waitForTimeout(300);
await p.locator(".mark").screenshot({path:out,omitBackground:true});
await b.close();
console.log("wrote",out);
