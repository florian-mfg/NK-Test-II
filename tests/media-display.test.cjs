const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const data = require('../sanity-data.js');
const context = vm.createContext({URL, document: {baseURI:'https://local.test/'}});
vm.runInContext(fs.readFileSync(require.resolve('../project-modules.js'),'utf8'), context);
const render = row => context.renderProjectModule(row);
const image = {asset:{_ref:'image-example-1200x800-jpg'},crop:{left:.1,right:.2,top:.1,bottom:.2},hotspot:{x:.5,y:.5,width:.2,height:.2}};
for (const type of Object.keys(data.layouts || {full:1,'half-half':2,'half-quarter-quarter':3,'quarter-quarter-quarter-quarter':4,'third-third-third':3,'two-thirds-one-third':2})) {
  test(`${type}: Crop compatibility, independent display, original image dimensions and lossless mapping`, () => {
    const count = {full:1,'half-half':2,'half-quarter-quarter':3,'quarter-quarter-quarter-quarter':4,'third-third-third':3,'two-thirds-one-third':2}[type];
    const source = {type,height:'medium',order:'reverse',slots:Array.from({length:count},()=>({type:'image',image}))};
    const normalize = row => data.normalizeModule(row).module;
    const baseline = normalize(source);
    for (const value of ['crop','invalid',null,{}]) {
      const row = normalize({...source,slots:source.slots.map(slot=>({...slot,mediaDisplay:value}))});
      assert.deepEqual(row, baseline);
      assert.equal(render(row),render(baseline));
    }
    const mixed = {...source,slots:source.slots.map((slot,i)=>({...slot,mediaDisplay:i%2?'crop':'auto'}))};
    const before = JSON.stringify(mixed);
    const row = normalize(JSON.parse(before));
    assert.equal(JSON.stringify(mixed),before);
    row.slots.forEach((slot,i)=>{
      const url = new URL(slot.src);
      assert.equal(url.searchParams.has('rect'),!!(i%2));
      if (!(i%2)) {assert.equal(url.searchParams.get('w'),'1200'); assert.equal(slot.image.width,1200);assert.equal(slot.image.height,800)}
    });
    assert.match(render(row), /media-display-auto/);
    assert.match(render(row), /width="1200" height="800"/);
    assert.deepEqual(normalize(mixed),row);
  });
}
test('Auto MP4 uses validated metadata and leaves playback choices intact',()=>{
  for(const dimensions of [{width:90,height:160},{aspectRatio:2},undefined,{width:-1,height:0}]) {
    const result = data.normalizeModule({type:'full',slots:[{type:'mp4',mediaDisplay:'auto',playback:'autoplay',video:{asset:{_ref:'file-demo-mp4',metadata:{dimensions}}}}]}).module;
    const slot=result.slots[0];
    assert.equal(slot.mediaDisplay,'auto');assert.equal(slot.playback,'autoplay');
    assert.equal(slot.aspectRatio,dimensions?.width===90?90/160:dimensions?.aspectRatio);
    assert.match(render(result),/autoplay muted loop/);
  }
});

test('Auto Height video posters bypass saved crops without altering the stored image',()=>{
  const source={type:'full',slots:[{type:'mp4',mediaDisplay:'auto',video:{asset:{_ref:'file-demo-mp4'}},poster:image}]};
  const before=JSON.stringify(source);
  const slot=data.normalizeModule(source).module.slots[0];
  assert.equal(new URL(slot.poster).searchParams.has('rect'),false);
  assert.ok(slot.posterImage.crop);
  assert.equal(JSON.stringify(source),before);
});

test('detail and Selected Work retain individual settings through JSON save, duplication and reordered compositions',()=>{
  const rows=Object.entries({full:1,'half-half':2,'half-quarter-quarter':3,'quarter-quarter-quarter-quarter':4,'third-third-third':3,'two-thirds-one-third':2}).map(([type,count])=>({type,height:'small',order:'reverse',slots:Array.from({length:count},(_,i)=>({type:'image',image,mediaDisplay:i%2?'crop':'auto'}))}));
  const saved=JSON.parse(JSON.stringify([...rows,structuredClone(rows[1])])).reverse();
  const raw={projects:[{_id:'test',_type:'project',title:'Test',slug:{current:'test'},category:'Commissioned',modules:saved,selectedWorkPreview:{composition:saved.map(row=>({...row,_type:`preview-${row.type}`}))}}]};
  const before=JSON.stringify(raw);
  const result=data.normalize(raw).projectsById.test;
  assert.equal(result.modulesValid,true);
  assert.deepEqual(result.modules,result.selectedWorkPreview.composition);
  assert.deepEqual(result.modules.map(row=>row.type),saved.map(row=>row.type));
  assert.ok(result.modules.every(row=>row.slots[0].mediaDisplay==='auto'));
  assert.equal(JSON.stringify(raw),before);
});
