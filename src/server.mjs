// Purpose: Serve the local workflow migration and baseline comparison application using the shared authenticated host.
import {startLocalApp} from '@gbesse/decision-workbench/apps';
import {createJevProvider} from '@gbesse/decisionpacks';
import {readFile} from 'node:fs/promises';
import {parseWorkflow,inspect,migrate,compare} from './index.mjs';
const demo=process.argv.includes('--demo');
const provider=demo?async({model,questions})=>{const keys=Object.keys(questions.route.criteria);return {model,answers:{route:{type:'choice',choice:keys[0],confidence:1,probabilities:Object.fromEntries(keys.map((k,i)=>[k,i===0?1:0]))}}};}:request=>createJevProvider()(request);
await startLocalApp({web:new URL('../web/',import.meta.url),database:process.env.APP_DATABASE??'.local/migrations.sqlite',token:process.env.APP_TOKEN,handle:async({path,body,store,method})=>{
 if(path==='/api/workspace'&&method==='GET')return {mode:demo?'synthetic':process.env.TYPESAFE_API_KEY?'live':'unconfigured',migrations:store.list('migration')};
 if(path==='/api/example'&&method==='GET')return {content:await readFile(new URL('../examples/classifier.yml',import.meta.url),'utf8')};
 if(path==='/api/import'&&method==='POST'){const flow=parseWorkflow(body.content);return store.create('migration',{flow,inspection:inspect(flow)});}
 if(method!=='POST')return;
 const saved=store.get('migration',body.id);if(!saved)throw Error('Import a workflow first');
 if(path==='/api/migrate')return migrate(saved.data.flow,body.nodeId,body.sourceFingerprint);
 if(path==='/api/compare'){const report=await compare(saved.data.flow,body.nodeId,body.cases,{provider,maxCalls:body.maxCalls,mode:demo?'synthetic':'live'});for(const r of report.results)if(r.status==='failed'){store.event('error',{message:r.error});console.error(r.error);}return store.create('comparison',report);}
}});
