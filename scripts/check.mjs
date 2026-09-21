// Purpose: Validate JavaScript syntax without compiling or building artifacts.
import {readdir} from 'node:fs/promises';import {spawnSync} from 'node:child_process';
async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory())await walk(p);else if(/\.(mjs|js|cjs)$/.test(p)){const r=spawnSync(process.execPath,['--check',p],{stdio:'inherit'});if(r.status!==0)process.exit(1);}}}
for(const dir of ['src','tests','scripts','web'])await walk(dir);
