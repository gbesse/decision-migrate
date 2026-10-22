import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseWorkflow} from '../src/index.mjs';
const source=await readFile(new URL('../examples/classifier.yml',import.meta.url),'utf8');
test('malformed graph identities are rejected at parse time, including unrelated nodes',()=>{
 for(const id of [null,0,{},[],true,'','  ']){
  const flow=parseWorkflow(source);flow.workflow.graph.nodes[0].id=id;
  assert.throws(()=>parseWorkflow(JSON.stringify(flow)),/Node identities/);
 }
 for(const node of [null,{},[]]){
  const flow=parseWorkflow(source);flow.workflow.graph.nodes[0]=node;
  assert.throws(()=>parseWorkflow(JSON.stringify(flow)),/Node identities/);
 }
});
test('identity diagnostics include all three languages and do not echo supplied node data',()=>{
 const flow=parseWorkflow(source);flow.workflow.graph.nodes[0].id={privateSentinel:'not-for-diagnostics'};
 assert.throws(()=>parseWorkflow(JSON.stringify(flow)),err=>{
  for(const text of ['Identifiants','Node identities','Identidades'])assert.ok(err.message.includes(text));
  assert.doesNotMatch(err.message,/not-for-diagnostics/);return true;
 });
});
