const test=require('node:test'),assert=require('node:assert/strict');
const api=require('../sanity-data.js'),collage=require('../frontpage-media-fade.js');
const image=(id='a')=>({asset:{_ref:`image-${id}-1200x800-jpg`}});
const document=media=>({_id:'homePage',_type:'homePage',media});
test('Frontpage ordered uploaded media reuse asset validation, preserve identity, crop, sizes and diagnostics',()=>{
 const raw={projects:[],homePage:document([
 {_key:'first',type:'image',size:'large',image:{...image(),crop:{left:.1,right:.1,top:0,bottom:0},hotspot:{x:.5,y:.5,width:1,height:1}}},
 {_key:'video',type:'mp4',size:'small',video:{asset:{_ref:'file-demo-mp4',metadata:{dimensions:{width:1080,height:1920}}}},poster:image('p')},
 {_key:'missing',type:'image'}, {_key:'unsupported',type:'vimeo'},
 {_key:'last',type:'image',size:'bad',image:image('b')},
 {_key:'first',type:'image',image:image('c')},
 {_key:'external',type:'mp4',video:{asset:{url:'https://external.test/movie.mp4'}}}
 ])};const before=JSON.stringify(raw),data=api.normalize(raw),media=data.homePage.media;
 assert.deepEqual(media.map(n=>n.id),['first','video','last']);assert.deepEqual(media.map(n=>n.size),['large','small','medium']);assert.equal(media[0].aspectRatio,960/800);assert.match(media[0].src,/rect=120%2C0%2C960%2C800/);assert.ok(media[0].hotspot);assert.equal(media[1].aspectRatio,1080/1920);assert.match(media[1].poster,/cdn.sanity.io/);assert.equal(media[1].type,'mp4');assert.ok(data.issues.some(n=>n.code==='duplicate_media'));assert.ok(data.issues.some(n=>n.code==='invalid_size'));assert.equal(JSON.stringify(raw),before);
 assert.match(api.query,/media\[\]\{_key,type,size,image/);
});
test('Frontpage distinguishes unavailable, legacy, malformed, explicit empty and all-invalid media',()=>{
 assert.equal(api.normalize({projects:[]}).homePage,null);
 for(const media of [undefined,null,'invalid'])assert.equal(api.normalize({projects:[],homePage:document(media)}).homePage.media,null);
 for(const media of [[],[{type:'image'}]])assert.deepEqual(api.normalize({projects:[],homePage:document(media)}).homePage.media,[]);
 const legacy={_id:'homePage',_type:'homePage',videoTitle:'Legacy',backgroundVideoUrl:'https://vimeo.com/123'};
 assert.equal(api.normalize({projects:[],homePage:legacy}).homePage.media,null);
});
test('CMS size categories scale each media responsively without stretching or overflow',()=>{
 for(const [w,h] of [[1440,900],[390,844]])for(const ratio of [.6,1.5]){
 const widths=['small','medium','large'].map(size=>{const b=collage.dimensions({size,aspectRatio:ratio},w,h);assert.ok(Math.abs(b.width/b.height-ratio)<1e-8);assert.ok(b.width<=w&&b.height<=h);return b.width});assert.ok(widths[0]<widths[1]&&widths[1]<widths[2]);
 }
});
