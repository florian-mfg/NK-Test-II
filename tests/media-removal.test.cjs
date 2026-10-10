'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {JSDOM}=require('../studio/node_modules/jsdom');
const data=require('../sanity-data.js');
const legacy={type:'video',vimeoUrl:'https://vimeo.com/12345/secret'};
const image={type:'image',image:{asset:{_ref:'image-photo-800x1200-jpg'}}};
const mp4={type:'mp4',video:{asset:{_ref:'file-film-mp4'}}};
test('legacy Vimeo-only rows disappear; mixed rows retain supported slot widths, order and content without mutation',()=>{
  const raw={projects:[{_id:'p',_type:'project',title:'Project',slug:{current:'p'},categories:['Graphic'],modules:[
    {type:'full',slots:[legacy]},
    {type:'half-quarter-quarter',height:'large',order:'middle',slots:[image,legacy,mp4]},
    {type:'half-half',slots:[legacy,{type:'empty'}]},
  ],selectedWorkPreview:{composition:[{_type:'preview-full',type:'full',slots:[legacy]},{_type:'preview-half-half',type:'half-half',slots:[image,legacy]}]}}]};
  const before=JSON.stringify(raw),project=data.normalize(raw).projects[0];
  assert.equal(JSON.stringify(raw),before);
  assert.equal(project.modulesValid,true);
  assert.equal(project.modules.length,1);assert.equal(project.detailModules.length,1);
  assert.deepEqual(project.modules[0].slots.map(slot=>slot?.type||null),['image',null,'mp4']);
  assert.deepEqual(project.modules[0].order,[1,0,2]);
  assert.equal(project.selectedWorkPreview.type,'half-half');
  const dom=new JSDOM('<main></main>',{runScripts:'outside-only',url:'https://preview.test'});
  try{
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../project-modules.js'),'utf8'),dom.getInternalVMContext());
    const html=dom.window.renderProjectModules(project.modules);
    const root=dom.window.document.querySelector('main');root.innerHTML=html;
    assert.equal(root.querySelectorAll('iframe').length,0);
    assert.equal(root.querySelectorAll('video').length,1);
    assert.equal(root.querySelectorAll('img').length,1);
    assert.deepEqual([...root.querySelector('.project-module').children].map(slot=>Number(slot.style.getPropertyValue('--slot-span'))),[3,6,3]);
    assert.equal(dom.window.renderProjectModule({type:'full',slots:[legacy]}),'');
  }finally{dom.window.close();}
});
test('unsupported-only explicit previews do not revive unrelated detail images',()=>{
  const raw={projects:[{_id:'p',_type:'project',title:'Project',slug:{current:'p'},category:'Graphic',modules:[{type:'full',slots:[image]}],selectedWorkPreview:{type:'video',vimeoUrl:legacy.vimeoUrl}}]};
  const p=data.normalize(raw).projects[0];
  assert.deepEqual(p.selectedWorkPreview,{composition:[]});
  assert.equal(p.modules[0].slots[0].type,'image');
});
test('active frontend and schema sources contain no Vimeo integration or iframe generation',()=>{
  const files=['app.js','project-video.js','project-modules.js','sanity-data.js','contrast.js','index.html','style.css','frontpage-media-fade.js'];
  const walk=directory=>fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(directory,entry.name)):[path.join(directory,entry.name)]);
  for(const file of [...files.map(file=>path.join(__dirname,'..',file)),...walk(path.join(__dirname,'../studio/schemaTypes'))]){
    const source=fs.readFileSync(file,'utf8');
    assert.doesNotMatch(source,/vimeo|<iframe|data-project-video-src/i,file);
  }
  assert.equal(fs.existsSync(path.join(__dirname,'../vimeo-media.js')),false);
});
