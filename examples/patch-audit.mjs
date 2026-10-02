// Verify that a synthetic Dify migration changes only the selected model.
import {readFile} from 'node:fs/promises';
import {parseWorkflow, inspect, migrate} from '../src/index.mjs';
const source = parseWorkflow(await readFile(new URL('./classifier.yml', import.meta.url), 'utf8'));
const inspection = inspect(source);
const selected = inspection.nodes.find(node => node.eligible);
if (!selected) throw new Error('No eligible synthetic classifier');
const result = migrate(source, selected.id, inspection.sourceFingerprint);
const before = source.workflow.graph.nodes.find(node => node.id === selected.id);
const after = result.workflow.workflow.graph.nodes.find(node => node.id === selected.id);
const preservedCategories = JSON.stringify(before.data.classes) === JSON.stringify(after.data.classes);
const preservedEdges = JSON.stringify(source.workflow.graph.edges) === JSON.stringify(result.workflow.workflow.graph.edges);
if (!preservedCategories || !preservedEdges || result.patch.length !== 2) throw new Error('Migration changed unexpected graph fields');
console.log(JSON.stringify({source: 'synthetic Dify DSL; no Dify or Jev call', node: selected.id, patchPaths: result.patch.map(step => step.path), preservedCategories, preservedEdges}, null, 2));
