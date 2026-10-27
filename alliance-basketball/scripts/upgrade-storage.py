from pathlib import Path
p=Path('server/api.ts');s=p.read_text(encoding='utf-8-sig')
s=s.replace("type DB={prepare:(sql:string)=>{bind:(...values:any[])=>any;first:()=>Promise<any>;run:()=>Promise<any>}};", "type DB={prepare:(sql:string)=>{bind:(...values:any[])=>any};batch:(queries:any[])=>Promise<any[]>};\nasync function readWorkspace(db:DB){const result=await db.prepare(\"SELECT w.*, c.part, c.content FROM workspaces w LEFT JOIN workspace_chunks c ON c.snapshot = json_extract(w.payload, '$.chunked') WHERE w.id = ? ORDER BY c.part\").bind('alliance').all();if(!result.results.length)return null;const row=result.results[0];const marker=JSON.parse(row.payload);return {...row,state:marker.chunked?JSON.parse(result.results.map((r:any)=>r.content).join('')):marker};}")
s=s.replace("await db.prepare('SELECT * FROM workspaces WHERE id = ?').bind('alliance').first()", "await readWorkspace(db)")
s=s.replace("const stored=JSON.parse(row.payload);", "const stored=row.state;")
s=s.replace("if(bodyText.length>12000000)","if(new TextEncoder().encode(bodyText).length>12000000)")
a=s.index('  const result=await db.prepare(\'UPDATE');b=s.index('  return json({revision:data.revision+1',a)
s=s[:a]+'''  const encoded=JSON.stringify(data.state),snapshot=crypto.randomUUID(),marker=JSON.stringify({chunked:snapshot});
  const statements=[db.prepare('UPDATE workspaces SET payload = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ?').bind(marker,new Date().toISOString(),'alliance',data.revision),db.prepare('DELETE FROM workspace_chunks WHERE EXISTS (SELECT 1 FROM workspaces WHERE id = ? AND payload = ?)').bind('alliance',marker)];
  for(let i=0;i<encoded.length;i+=300000)statements.push(db.prepare('INSERT INTO workspace_chunks (snapshot, part, content) SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM workspaces WHERE id = ? AND payload = ?)').bind(snapshot,i/300000,encoded.slice(i,i+300000),'alliance',marker));
  const results=await db.batch(statements);
  if(results[0].meta.changes!==1)return json({error:'Another device updated this workspace. Your action was not applied. Refresh and retry.'},409);
'''+s[b:];p.write_text(s,encoding='utf-8')
p=Path('scripts/local-api.mjs');s=p.read_text(encoding='utf-8-sig');s=s.replace("readFile}","readFile,readdir}")
a=s.index('const migration=');b=s.index('createServer(',a)
s=s[:a]+'''for(const file of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort()){const sql=await readFile('drizzle/'+file,'utf8');db.exec(sql.replaceAll('CREATE TABLE','CREATE TABLE IF NOT EXISTS'));}
const adapter={prepare(sql){const stmt=db.prepare(sql);return {bind(...values){return {first(){return stmt.get(...values)??null;},all(){return {results:stmt.all(...values)};},run(){const r=stmt.run(...values);return {meta:{changes:Number(r.changes)}};}};}};},batch(queries){db.exec('BEGIN IMMEDIATE');try{const results=queries.map(q=>q.run());db.exec('COMMIT');return results;}catch(e){db.exec('ROLLBACK');throw e;}}};
'''+s[b:];p.write_text(s,encoding='utf-8')
