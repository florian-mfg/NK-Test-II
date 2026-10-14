const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const helper=require('./frontpage-brush-browser-helpers.cjs');
for(const engine of ['chromium','webkit'])test(`${engine}: geometric exits, exact shared edges, fast input and off-screen continuation`,{skip:!process.env.BROWSER_TEST,timeout:120000},async()=>{
 const pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core');
 const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
 const out=path.join(__dirname,'..','reports','brush-boundary');fs.mkdirSync(out,{recursive:true});
 try{for(const mobile of [false,true]){
  const s=await helper.setup(browser,engine,mobile,helper.fixture());
  for(const edge of ['right','left','top','bottom']){
   await s.load();await s.seed();const r=await s.current();
   const horizontal=['left','right'].includes(edge),offset=Math.round(horizontal?r.y+r.h*.35:r.x+r.w*.35);
   const from={x:horizontal?r.x+r.w/2:offset,y:horizontal?offset:r.y+r.h/2};
   await s.move(from.x,from.y);
   for(let i=0;i<8;i++)await s.move(r.x+r.w*(.2+.05*i),r.y+r.h*(.8-.07*i));
   assert.equal(await s.progress(),1,'moving inside does not spawn');
   await s.move(from.x,from.y);
   const to={x:horizontal?(edge==='right'?r.x+r.w+2:r.x-2):offset,y:horizontal?offset:(edge==='bottom'?r.y+r.h+2:r.y-2)};
   await s.move(to.x,to.y);assert.equal(await s.progress(),2);const n=await s.current();
   assert.equal(n.exit,edge);assert.ok(helper.connected(r,n));
   if(n.edge===edge && horizontal){assert.ok(Math.abs(n.y-(offset-n.h/2))<.01);assert.ok(Math.abs(n.stamp.y-offset)<.01);}
   else if(n.edge===edge){assert.ok(Math.abs(n.x-(offset-n.w/2))<.01);assert.ok(Math.abs(n.stamp.x-offset)<.01);}
   await helper.verify(s);await s.end();
  }
  await s.load();await s.seed();let r=await s.current();
  await s.move(r.x+r.w/2,r.y+r.h/2);
  await s.move(s.viewport.width-5,s.viewport.height-5);assert.equal(await s.progress(),2,'fast movement emits once');
  await s.move(s.viewport.width-2,s.viewport.height-2);assert.equal(await s.progress(),2,'outside-only movement does not catch up');
  await helper.verify(s);await s.end();
  await s.load();await s.seed();r=await s.current();
  await s.move(r.x+r.w/2,r.y+r.h/2);await s.move(r.x+r.w+20,r.y+r.h+20);
  assert.equal(await s.progress(),2,'diagonal corner exit emits once');assert.equal((await s.current()).exit,'right');
  await helper.verify(s);await s.end();
  await s.load();await s.seed(s.viewport.width-10,100);r=await s.current();
  await s.move(r.x+r.w/2,r.y+r.h/2);
  assert.ok(r.x+r.w>s.viewport.width,'first image intentionally extends outside viewport');
  await s.move(s.viewport.width-1,r.y+r.h/2);assert.equal(await s.progress(),2,'outward movement across the visible edge band continues');
  assert.equal((await s.current()).edge,'continuation');
  await s.move(s.viewport.width-2,r.y+r.h/2);assert.equal(await s.progress(),2,'edge motion does not repeatedly spawn');
  await s.move(s.viewport.width-40,r.y+r.h/2);await s.move(s.viewport.width-1,r.y+r.h/2);assert.equal(await s.progress(),3,'a fresh deliberate band crossing continues');
  await helper.verify(s);
  await s.page.screenshot({path:path.join(out,`${engine}-${mobile?'touch':'mouse'}-edge.png`)});
  const frozen=await s.snapshot();await s.page.waitForTimeout(100);assert.deepEqual(await s.snapshot(),frozen);
  await s.end();await s.page.close();
 }
 }finally{await browser.close();}
});
