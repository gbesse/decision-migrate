// Purpose: Prove branch preservation, fail-closed unsupported migrations and measured-baseline comparison semantics.
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {parseWorkflow,inspect,migrate,compare,targetModel} from '../src/index.mjs';
const source=await readFile(new URL('../examples/classifier.yml',import.meta.url),'utf8');
test('migration changes only the selected model and preserves branch identities and YAML roundtrip',()=>{
 const before=parseWorkflow(source),inspection=inspect(before),result=migrate(before,'classifier',inspection.sourceFingerprint),expected=structuredClone(before);
 expected.workflow.graph.nodes[1].data.model=targetModel;assert.deepEqual(result.workflow,expected);assert.deepEqual(parseWorkflow(result.yaml),expected);assert.notDeepEqual(before,expected);assert.equal(result.patch[0].op,'test');
});
test('vision, memory, bad categories, templates, aliases and stale workflows fail closed',()=>{
 for(const change of [{vision:{enabled:true}},{memory:{}},{instruction:'{{#secret#}}'},{classes:[{id:'same',name:'A'},{id:'same',name:'B'}]}]){const flow=parseWorkflow(source);Object.assign(flow.workflow.graph.nodes[1].data,change);assert.equal(inspect(flow).nodes[0].eligible,false);assert.throws(()=>migrate(flow,'classifier',inspect(flow).sourceFingerprint));}
 assert.throws(()=>parseWorkflow(source+'\na: &a [1]\nb: *a'),/alias/i);assert.throws(()=>migrate(parseWorkflow(source),'classifier','stale'),/changed/);
});
test('comparison validates all cases before spending and distinguishes disagreement from failed inference',async()=>{
 const flow=parseWorkflow(source);let calls=0;const provider=async()=>{calls++;return {model:'jev-1.13.0',answers:{route:{type:'choice',choice:'billing',confidence:.8,probabilities:{billing:.9,technical:.1}}}};};
 await assert.rejects(()=>compare(flow,'classifier',[{query:'valid',baseline:'billing'},{query:'bad',baseline:'missing'}],{provider}),/baseline/);assert.equal(calls,0);
 const result=await compare(flow,'classifier',[{query:'API error',baseline:'technical'}],{provider,maxCalls:1,mode:'synthetic'});assert.equal(result.disagreements,1);assert.equal(result.costSavings,null);assert.equal(result.results[0].baselineLatencyMs,null);
 const failed=await compare(flow,'classifier',[{query:'API error',baseline:'technical'}],{provider:async()=>{throw Error('provider unavailable');},maxCalls:1});assert.equal(failed.failures,1);assert.equal(failed.results[0].record,undefined);
});


test('comparison snapshots baseline cases and workflow identity before async inference',async()=>{
 const flow=parseWorkflow(source),before=inspect(flow).sourceFingerprint,cases=[{query:'original',baseline:'technical',latencyMs:12},{query:'next',baseline:'technical',latencyMs:34}];let calls=0;
 const provider=async()=>{calls++;cases[0].baseline='billing';cases[0].latencyMs=999;cases[1].query='changed';cases[1].baseline='billing';flow.workflow.graph.nodes[1].data.instruction='changed';return {model:'jev-1.13.0',answers:{route:{type:'choice',choice:'billing',confidence:.9,probabilities:{billing:.9,technical:.1}}}};};
 const report=await compare(flow,'classifier',cases,{provider,maxCalls:2,mode:'synthetic'});
 assert.equal(report.sourceFingerprint,before);assert.equal(report.disagreements,2);assert.equal(report.results[0].baselineLatencyMs,12);assert.equal(report.results[1].state.query,'next');assert.equal(calls,2);
});
test('provider diagnostics are absent from comparison records',async()=>{
 const report=await compare(parseWorkflow(source),'classifier',[{query:'q',baseline:'billing'}],{provider:async()=>{throw Error('synthetic-private-diagnostic');}});
 assert.equal(report.failures,1);assert.doesNotMatch(JSON.stringify(report),/synthetic-private-diagnostic/);
 for(const text of ['Échec de comparaison','Comparison failed','Falló la comparación'])assert.ok(report.results[0].error.includes(text));
});
