'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const data=require('../sanity-data.js');
test('Thermik workaround module-key plumbing is removed',()=>{
 const source={_key:'551aa84a3b0b',type:'two-thirds-one-third',height:'large',slots:[null,null]};
 const module=data.normalizeModule(source).module;
 assert.equal(module.key,undefined);
 const context=vm.createContext({URL,document:{baseURI:'https://fixture.test/'}});
 vm.runInContext(fs.readFileSync(require.resolve('../project-modules.js'),'utf8'),context);
 assert.ok(!context.renderProjectModule(module).includes('data-module-key'));
 assert.ok(!fs.readFileSync(require.resolve('../style.css'),'utf8').includes('551aa84a3b0b'));
});
