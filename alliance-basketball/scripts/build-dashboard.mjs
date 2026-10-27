import {build as viteBuild} from 'vite';import {build} from 'esbuild';import {mkdir,writeFile,readFile} from 'node:fs/promises';
await viteBuild();await mkdir('dist/server',{recursive:true});await build({entryPoints:['server/worker.ts'],bundle:true,platform:'browser',format:'esm',target:'es2022',outfile:'dist/server/index.js'});
await writeFile('dist/server/wrangler.json',JSON.stringify({name:'alliance-basketball',main:'index.js',compatibility_date:'2026-05-15',compatibility_flags:['nodejs_compat'],assets:{directory:'../client',binding:'ASSETS',not_found_handling:'single-page-application',run_worker_first:true},d1_databases:[{binding:'DB',database_name:'alliance',database_id:'00000000-0000-4000-8000-000000000000'}]},null,2));
console.log('Client and Cloudflare Worker built.');
