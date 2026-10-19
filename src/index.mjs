// Purpose: Inspect a bounded Dify DSL subset, change only the classifier model, and compare against recorded baseline outcomes.
import {parseDocument,stringify} from 'yaml';
import {evaluate,fingerprint,validatePack} from '@gbesse/decisionpacks';
const ensure=(v,m)=>{if(!v)throw Error(m);};
export const targetModel={provider:'langgenius/typesafe_ai/typesafe_ai',name:'jev-1.13.0-only-for-question-classifier',mode:'chat',completion_params:{}};
export function parseWorkflow(text){
 ensure(typeof text==='string'&&Buffer.byteLength(text)<=3000000,'Workflow must be UTF-8 YAML/JSON below 3 MB');
 const doc=parseDocument(text,{uniqueKeys:true});ensure(!doc.errors.length&&!doc.warnings.length,'Invalid or unsupported YAML');
 const flow=doc.toJS({maxAliasCount:0});ensure(flow?.kind==='app'&&flow.version==='0.3.1','Supported Dify DSL version: 0.3.1');
 ensure(Array.isArray(flow.workflow?.graph?.nodes)&&Array.isArray(flow.workflow.graph.edges),'Dify workflow graph required');
 ensure(flow.workflow.graph.nodes.length<=500,'Maximum 500 nodes');
 ensure(new Set(flow.workflow.graph.nodes.map(n=>n.id)).size===flow.workflow.graph.nodes.length,'Duplicate node ids');return flow;
}
function unsupported(node,flow){
 const d=node.data,reasons=[];
 if(d?.type!=='question-classifier')return ['Only question-classifier nodes can migrate'];
 if(d.model?.mode!=='chat')reasons.push('Only chat classifiers are supported');
 if(d.vision?.enabled)reasons.push('Vision classifier not supported');
 if(d.memory)reasons.push('Conversation memory requires a separate migration');
 if(typeof d.instruction!=='string'||d.instruction.includes('{{'))reasons.push('Use literal classification instructions');
 if(!Array.isArray(d.query_variable_selector)||d.query_variable_selector.length!==2||!d.query_variable_selector.every(x=>typeof x==='string'))reasons.push('Expected a two-part text input selector');
 if(!Array.isArray(d.classes)||d.classes.length<2||d.classes.length>255||d.classes.some(c=>!c||typeof c.name!=='string'||!c.name.trim()||!/^[-a-zA-Z0-9_]+$/.test(c.id)||['constructor','prototype','__proto__'].includes(c.id))||new Set(d.classes?.map(c=>c.id)).size!==d.classes?.length)reasons.push('Expected 2–255 distinct finite category ids and descriptions');
 if(d.model?.provider===targetModel.provider)reasons.push('Already uses TypeSafe');if(flow&&Array.isArray(d.classes)&&d.classes.every(c=>c&&typeof c.id==='string')){const routing=routingAudit(flow,node.id);if(!routing.valid)reasons.push('Branches manquantes, inconnues ou sans destination / Missing, unknown or dangling classifier branches / Ramas ausentes, desconocidas o sin destino');}return reasons;
}
export function inspect(flow){return {sourceFingerprint:fingerprint(flow),nodes:flow.workflow.graph.nodes.filter(n=>n.data?.type==='question-classifier').map(n=>({id:n.id,title:n.data.title??n.id,eligible:unsupported(n,flow).length===0,reasons:unsupported(n,flow),classes:n.data.classes,model:n.data.model,routing:routingAudit(flow,n.id)})),warning:'Install/configure the official TypeSafe provider in Dify before importing. This tool validates the DSL subset; it does not execute the Dify host.'};}
export function migrate(flow,nodeId,expectedFingerprint){
 ensure(fingerprint(flow)===expectedFingerprint,'Workflow changed since inspection');
 const index=flow.workflow.graph.nodes.findIndex(n=>n.id===nodeId);ensure(index>=0,'Unknown node');const node=flow.workflow.graph.nodes[index];ensure(!unsupported(node,flow).length,unsupported(node,flow).join('; '));
 const workflow=structuredClone(flow),before=structuredClone(node.data.model);workflow.workflow.graph.nodes[index].data.model=structuredClone(targetModel);
 // Preserve every branch ID, edge, query selector, instruction and unrelated node. Do not guess plugin dependency hashes.
 return {workflow,yaml:stringify(workflow),patch:[{op:'test',path:`/workflow/graph/nodes/${index}/data/model`,value:before},{op:'replace',path:`/workflow/graph/nodes/${index}/data/model`,value:structuredClone(targetModel)}],sourceFingerprint:fingerprint(flow),resultFingerprint:fingerprint(workflow),requiredProvider:targetModel.provider,routing:routingAudit(flow,nodeId)};
}
export function classifierPack(flow,nodeId){
 const n=flow.workflow.graph.nodes.find(n=>n.id===nodeId);ensure(n&&!unsupported(n,flow).length,'Unsupported classifier');const criteria=Object.fromEntries(n.data.classes.map(c=>[c.id,c.name]));
 return validatePack({schemaVersion:1,name:'migration/dify-classifier',version:'0.1.0',description:'Finite classification probe; compare with recorded Dify outcomes before migration.',model:'jev-1.13.0',inputs:{query:'string',history_text:'string'},questions:{route:{type:'choice',instructions:'Classify state.query into exactly one category. '+n.data.instruction,criteria}},rules:Object.keys(criteria).map(id=>({id:'route-'+id,outcome:id,all:[{field:'answers.route.choice',op:'eq',value:id}]})),fallback:'review'});
}
export async function compare(flow,nodeId,cases,{provider,maxCalls=10,mode='live'}={}){
 flow=structuredClone(flow);const sourceFingerprint=fingerprint(flow);
 const pack=classifierPack(flow,nodeId),ids=new Set(Object.keys(pack.questions.route.criteria));
 ensure(Array.isArray(cases)&&cases.length>0&&Number.isInteger(maxCalls)&&maxCalls>=1&&maxCalls<=20&&cases.length<=maxCalls,'Provide 1–20 baseline cases within the call budget');
 for(const c of cases){ensure(typeof c.query==='string'&&c.query.length<=30000&&ids.has(c.baseline),'Each case needs query and an existing baseline category id');ensure(c.latencyMs===undefined||(Number.isFinite(c.latencyMs)&&c.latencyMs>=0),'Invalid baseline latency');}
 cases=cases.map(c=>({query:c.query,baseline:c.baseline,latencyMs:c.latencyMs}));
 const results=[],deadline=AbortSignal.timeout(85000);let calls=0;
 for(const c of cases){const state={query:c.query,history_text:''};if(deadline.aborted){results.push({state,baseline:c.baseline,status:'failed',error:'Délai atteint, non tenté / Deadline reached, not attempted / Plazo alcanzado, no intentado'});continue;}try{calls++;const record=await evaluate(pack,state,{provider,timeoutMs:30000,signal:deadline});results.push({state,baseline:c.baseline,baselineLatencyMs:c.latencyMs??null,record,agrees:c.baseline===record.outcome,status:'succeeded'});}catch{results.push({state,baseline:c.baseline,status:'failed',error:'Échec de comparaison / Comparison failed / Falló la comparación'});}}
 return {schemaVersion:1,sourceFingerprint,mode,comparison:'Recorded baseline vs independent Jev probe; not a full Dify execution',pack,results,calls,disagreements:results.filter(r=>r.status==='succeeded'&&!r.agrees).length,failures:results.filter(r=>r.status==='failed').length,costSavings:null};
}

export function routingAudit(flow,nodeId){
 const nodes=flow.workflow.graph.nodes,edges=flow.workflow.graph.edges,node=nodes.find(n=>n.id===nodeId);
 ensure(node,'Classifieur déclaré requis / Declared classifier required / Se requiere clasificador declarado');
 if(!Array.isArray(node.data?.classes)||node.data.classes.some(c=>!c||typeof c.id!=='string'||!c.id))return{branches:[],missingCategories:[],unknownHandles:[],danglingTargets:[],invalidCategories:true,valid:false};
 const ids=new Set(nodes.map(n=>n.id)),categories=node.data.classes.map(c=>c.id),outgoing=edges.filter(e=>e?.source===nodeId);
 const branches=categories.map(categoryId=>({categoryId,targets:outgoing.filter(e=>e.sourceHandle===categoryId).map(e=>e.target)}));
 const missingCategories=branches.filter(b=>!b.targets.length).map(b=>b.categoryId);
 const unknownHandles=outgoing.filter(e=>!categories.includes(e.sourceHandle)).map(e=>e.sourceHandle??null);
 const danglingTargets=outgoing.filter(e=>typeof e.target!=='string'||!ids.has(e.target)).map(e=>({edgeId:e.id??null,target:e.target??null}));
 return{branches,missingCategories,unknownHandles,danglingTargets,valid:!missingCategories.length&&!unknownHandles.length&&!danglingTargets.length};
}
