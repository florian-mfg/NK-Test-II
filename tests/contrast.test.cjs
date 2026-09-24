'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {choose, sample, mode} = require('../contrast.js');
const adapter = require('../sanity-data.js');

test('binary contrast uses local image luminance, manual overrides and stable thresholds',()=>{
 const grid=new Uint8ClampedArray(64*64*4);
 for(let y=0;y<64;y++) for(let x=0;x<64;x++) {
  const i=(y*64+x)*4;grid[i]=grid[i+1]=grid[i+2]=x<32?255:0;grid[i+3]=255;
 }
 assert.equal(choose('auto',sample(grid,.1,.5)),'#000000');
 assert.equal(choose('auto',sample(grid,.9,.5)),'#ffffff');
 assert.equal(sample(new Uint8ClampedArray(64*64*4),.5,.5,1,0),0);
 assert.equal(choose('black',0),'#000000');
 assert.equal(choose('white',1),'#ffffff');
 assert.equal(choose('auto',NaN),'#ffffff');
 assert.equal(choose('black',NaN),'#000000');
 assert.equal(choose('auto',.18,'#ffffff'),'#ffffff');
 assert.equal(choose('auto',.18,'#000000'),'#000000');
 for(const value of [undefined,null,'','invalid']) assert.equal(mode(value),'auto');
});

test('CMS contrast modes are optional and preserve existing project and Index content',()=>{
 for(const value of [undefined,null,'','auto','black','white','invalid']) {
  const textColor=mode(value);
  const raw={homePage:{_id:'homePage',_type:'homePage',textColor:value,backgroundVideoUrl:'https://vimeo.com/12345'},
   projects:[{_id:'p',_type:'project',title:'P',slug:{current:'p'},category:'Video',textColor:value,modules:[]}],
   indexPage:{_id:'indexPage',_type:'indexPage',entries:[{displayTitle:'I',textColor:value,previewImages:[{asset:{_ref:'image-p-800x1200-jpg'}}]}]}};
  const before=JSON.stringify(raw),data=adapter.normalize(raw);
  assert.equal(data.homePage.textColor,textColor);
  assert.equal(data.projects[0].textColor,textColor);
  assert.equal(data.indexPage.entries[0].textColor,textColor);
  assert.equal(JSON.stringify(raw),before);
 }
 assert.match(adapter.query, /backgroundVideoUrl/);
 assert.equal((adapter.query.match(/textColor/g)||[]).length,3);
});

test('CSS has no blend or inversion effects; iframe pixel inspection is not implemented',()=>{
 const css=fs.readFileSync(require.resolve('../style.css'),'utf8');
 assert.doesNotMatch(css,/mix-blend-mode|\binvert\(/);
 const js=fs.readFileSync(require.resolve('../contrast.js'),'utf8');
 assert.doesNotMatch(js,/contentWindow|contentDocument|requestAnimationFrame/);
});
