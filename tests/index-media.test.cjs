'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const adapter = require('../sanity-data.js');
const {parse, evaluate} = require('node:module').createRequire(require('node:path').resolve(__dirname, '../studio/package.json'))('groq-js');
const image = (position) => ({_type:'image',asset:{_ref:'image-demo-800x1200-jpg'},alt:'Portrait',portraitPosition:position,
  crop:{left:0,right:0,top:0,bottom:0},hotspot:{x:.5,y:.5,width:1,height:1}});
const vimeo = {_type:'indexMedia',mediaType:'vimeo',vimeoUrl:'https://vimeo.com/123456/secret'};
const mp4 = {_type:'indexMedia',mediaType:'mp4',video:{asset:{_ref:'file-demo-mp4'}}};
const normalize = previewImages => adapter.normalize({indexPage:{_id:'indexPage',_type:'indexPage',entries:[{displayTitle:'Mixed',previewImages}]}});

test('mixed Index media retain order, privacy hash, file URL and legacy image metadata without writes', () => {
  const input = [image('left'),vimeo,mp4], before=structuredClone(input);
  const entry=normalize(input).indexPage.entries[0];
  assert.deepEqual(input,before);
  assert.deepEqual(entry.media.map(x=>x.type),['image','vimeo','mp4']);
  assert.equal(entry.media[0].portraitPosition,'left');
  assert.deepEqual(entry.media[0].hotspot,input[0].hotspot);
  assert.equal(new URL(entry.media[1].embedUrl).searchParams.get('h'),'secret');
  assert.equal(entry.media[2].src,'https://cdn.sanity.io/files/ck6xe2er/production/demo.mp4');
});

test('legacy and new image wrappers normalize identically for every portrait position', () => {
  for(const position of ['left','center','right',undefined]) {
    const legacy=normalize([image(position)]).indexPage.entries[0];
    const wrapped=normalize([{_type:'indexMedia',mediaType:'image',image:image(position)}]).indexPage.entries[0];
    assert.deepEqual(wrapped,legacy);
    assert.deepEqual(legacy.previewImages[0],(({type,...rest})=>rest)(legacy.media[0]));
  }
});

test('video-only Index entries work and malformed media do not suppress valid siblings', () => {
  assert.deepEqual(normalize([mp4,vimeo,mp4]).indexPage.entries[0].media.map(x=>x.type),['mp4','vimeo','mp4']);
  const invalid=[{...mp4,video:{asset:{url:'https://evil.test/a.mp4'}}},
    {...mp4,video:{asset:{_ref:'file-a-webm'}}}, {...vimeo,vimeoUrl:'javascript:alert(1)'},
    {mediaType:'other'}, {mediaType:'image'}, null];
  for(const item of invalid) {
    const result=normalize([item,image('right')]);
    assert.equal(result.indexPage.entries[0].media.length,1);
    assert.equal(result.indexPage.entries[0].media[0].type,'image');
  }
});

test('public GROQ dereferences uploaded MP4 and wrapped images alongside legacy data', async () => {
  const dataset=[{_id:'indexPage',_type:'indexPage',entries:[{displayTitle:'Mixed',previewImages:[image('left'),vimeo,mp4]}]},
    {_id:'image-demo-800x1200-jpg',_type:'sanity.imageAsset',url:'https://cdn.sanity.io/images/ck6xe2er/production/demo-800x1200.jpg',metadata:{dimensions:{width:800,height:1200}}},
    {_id:'file-demo-mp4',_type:'sanity.fileAsset',url:'https://cdn.sanity.io/files/ck6xe2er/production/demo.mp4',mimeType:'video/mp4'}];
  const raw=await (await evaluate(parse(adapter.query),{dataset})).get();
  assert.equal(raw.indexPage.entries[0].previewImages[2].video.asset.mimeType,'video/mp4');
  assert.deepEqual(adapter.normalize(raw).indexPage.entries[0].media.map(x=>x.type),['image','vimeo','mp4']);
  dataset[0].entries[0].previewImages=[{mediaType:'image',image:image('right')}];
  const wrapped=await (await evaluate(parse(adapter.query),{dataset})).get();
  assert.equal(adapter.normalize(wrapped).indexPage.entries[0].media[0].portraitPosition,'right');
});
