import test from 'node:test'
import assert from 'node:assert/strict'
import {createSchema} from 'sanity'
import {validateDocument} from '@sanity/validation'
import {homePage} from '../schemaTypes/documents/pages.ts'
import {frontpageMedia} from '../schemaTypes/objects/frontpageMedia.ts'
import {schemaTypes} from '../schemaTypes/index.ts'
import {structure, singletonTypes} from '../structure.ts'
const schema=createSchema({name:'frontpage-media-tests',types:schemaTypes})
const image={_type:'image',asset:{_type:'reference',_ref:'image-demo-1200x800-jpg'}}
const video={_type:'file',asset:{_type:'reference',_ref:'file-demo-mp4'}}
const errors=async document=>(await validateDocument({schema,document,customValidation:true,getDocumentExists:async()=>true})).markers.filter(n=>n.level==='error')
test('Startseite reuses homePage singleton and offers ordered uploads with Medium default and useful previews',()=>{
 assert.equal(homePage.name,'homePage');assert.equal(homePage.title,'Startseite');assert.ok(singletonTypes.has('homePage'));
 const media=homePage.fields.find(n=>n.name==='media');assert.equal(media.type,'array');assert.equal(media.options.sortable,true);assert.equal(media.of[0].type,'frontpageMedia');
 assert.equal(schemaTypes.filter(n=>n.name==='homePage').length,1);
 assert.deepEqual(frontpageMedia.initialValue,{type:'image',size:'medium'});
 const field=name=>frontpageMedia.fields.find(n=>n.name===name);
 assert.deepEqual(field('size').options.list.map(n=>n.value),['small','medium','large']);assert.equal(field('size').initialValue,'medium');assert.equal(field('video').options.accept,'video/mp4');assert.equal(field('image').options.hotspot,true);
 assert.deepEqual(field('type').options.list.map(n=>n.value),['image','mp4']);assert.equal(field('video').hidden({parent:{type:'image'}}),true);
 assert.equal(frontpageMedia.preview.prepare({type:'mp4',size:'large',filename:'Film.mp4'}).title,'Film.mp4');assert.equal(frontpageMedia.preview.prepare({type:'image',size:'small',image}).subtitle,'Small');
 const titles=[];const builder=new Proxy({}, {get:(_,key)=>(...args)=>{if(key==='title')titles.push(args[0]);if(key==='divider')return {};return builder}});structure(builder);assert.ok(titles.includes('Startseite'));
});
test('uploaded images/videos, empty sequence and legacy home documents validate without mutation',async()=>{
 for(const document of [
 {_id:'homePage',_type:'homePage',media:[{_key:'a',_type:'frontpageMedia',type:'image',size:'large',image},{_key:'b',_type:'frontpageMedia',type:'mp4',size:'medium',video,poster:image}]},
 {_id:'homePage',_type:'homePage',media:[]},
 {_id:'homePage',_type:'homePage',videoTitle:'Legacy',backgroundVideoUrl:'https://vimeo.com/123'},
 ]){const before=JSON.stringify(document);assert.deepEqual(await errors(document),[]);assert.equal(JSON.stringify(document),before)}
 for(const item of [{type:'image',size:'medium'},{type:'mp4',size:'medium',video:{...video,asset:{_ref:'file-demo-mov'}}},{type:'image',image},{type:'image',image,size:'invalid'}])assert.ok((await errors({_id:'homePage',_type:'homePage',media:[{_key:'a',_type:'frontpageMedia',...item}]})).length>0);
});

test('Frontpage accepts twenty ordered uploads and rejects twenty-one without mutation',async()=>{
 const make=count=>({_id:'homePage',_type:'homePage',media:Array.from({length:count},(_,i)=>({_key:`media-${i}`,_type:'frontpageMedia',type:i%2?'mp4':'image',size:['small','medium','large'][i%3],...(i%2?{video}:{image})}))});
 assert.deepEqual(await errors(make(20)),[]);
 const tooMany=make(21),before=JSON.stringify(tooMany);
 assert.ok((await errors(tooMany)).some(marker=>marker.path[0]==='media'));
 assert.equal(JSON.stringify(tooMany),before);
});
test('visible-media limit is an optional integer 1–10 with default three, independent of collection size',async()=>{
 const field=homePage.fields.find(n=>n.name==='visibleMediaLimit');
 assert.equal(field.type,'number');assert.equal(field.title,'Simultaneously Visible Media');assert.equal(field.initialValue,3);
 assert.equal(field.description,'Choose how many images or videos can be visible on the Frontpage at the same time.');
 for(const value of [undefined,1,2,3,5,7,10])assert.deepEqual(await errors({_id:'homePage',_type:'homePage',visibleMediaLimit:value,media:[]}),[]);
 for(const value of [0,-1,11,1.5,'5'])assert.ok((await errors({_id:'homePage',_type:'homePage',visibleMediaLimit:value,media:[]})).length>0);
 const document={_id:'homePage',_type:'homePage',visibleMediaLimit:1,media:Array.from({length:20},(_,i)=>({_key:`limit-${i}`,_type:'frontpageMedia',type:'image',size:'medium',image}))};
 const before=JSON.stringify(document);assert.deepEqual(await errors(document),[]);assert.equal(JSON.stringify(document),before);
});
