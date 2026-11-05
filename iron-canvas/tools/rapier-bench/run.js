const {chromium}=require('playwright');const fs=require('fs'),path=require('path');
const RAP=process.argv[2]||'/home/user/dl/rapier/rapier.mjs';
(async()=>{
  const b=await chromium.launch({args:['--use-angle=swiftshader','--use-gl=angle','--enable-unsafe-swiftshader']});
  const pg=await b.newPage();
  await pg.route('http://bench.local/**',r=>{
    const u=new URL(r.request().url()).pathname;
    if(u==='/bench.html')return r.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(__dirname,'bench.html'))});
    if(u==='/rapier.mjs')return r.fulfill({contentType:'text/javascript',body:fs.readFileSync(RAP)});
    r.fulfill({status:404,body:''});
  });
  pg.on('console',m=>console.log('[page]',m.text()));pg.on('pageerror',e=>console.log('[err]',e.message));
  await pg.goto('http://bench.local/bench.html');
  const res=await pg.evaluate(()=>window.runBench());
  res.moduleBytes=fs.statSync(RAP).size;res.cores=require('os').cpus().length;res.cpu=require('os').cpus()[0].model;
  console.log(JSON.stringify(res,null,1));
  fs.writeFileSync(path.join(__dirname,'results.json'),JSON.stringify(res,null,1));
  await b.close();
})();
