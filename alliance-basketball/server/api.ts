import {initialState,assertState,total,sourceName} from '../lib/engine';
type DB={prepare:(sql:string)=>{bind:(...values:any[])=>any};batch:(queries:any[])=>Promise<any[]>};
async function readWorkspace(db:DB){const result=await db.prepare("SELECT w.*, c.part, c.content FROM workspaces w LEFT JOIN workspace_chunks c ON c.snapshot = json_extract(w.payload, '$.chunked') WHERE w.id = ? ORDER BY c.part").bind('alliance').all();if(!result.results.length)return null;const row=result.results[0];const marker=JSON.parse(row.payload);return {...row,state:marker.chunked?JSON.parse(result.results.map((r:any)=>r.content).join('')):marker};}
const json=(data:any,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'}});
export async function handleApi(request:Request,db:DB){
 const user=request.headers.get('oai-authenticated-user-id'),email=request.headers.get('oai-authenticated-user-email')?.toLowerCase();
 if(!user||!email)return json({error:'Sign in to access Alliance Basketball.',signIn:'/signin-with-chatgpt?return_to=/'},401);
 const url=new URL(request.url);
 if(!['/api/workspace','/api/spectator'].includes(url.pathname))return json({error:'Not found'},404);
 if(!['GET','PUT'].includes(request.method))return json({error:'Method not allowed'},405);
 if(url.pathname==='/api/spectator'&&request.method!=='GET')return json({error:'Read-only view.'},405);
 if(request.method==='PUT'&&((request.headers.get('origin')&&request.headers.get('origin')!==url.origin)||request.headers.get('sec-fetch-site')==='cross-site'))return json({error:'Request origin rejected.'},403);
 try{
  let row=await readWorkspace(db);
  if(!row&&url.pathname==='/api/spectator')return json({matches:[],serverTime:Date.now()});
  if(!row){await db.prepare('INSERT OR IGNORE INTO workspaces (id, owner, owner_email, revision, payload, updated_at) VALUES (?, ?, ?, ?, ?, ?)').bind('alliance',user,email,0,JSON.stringify(initialState()),new Date().toISOString()).run();row=await readWorkspace(db);}
  const stored=row.state;const isOwner=row.owner===user;
  if(url.pathname==='/api/spectator')return json({serverTime:Date.now(),matches:stored.tournaments.flatMap((t:any)=>t.games.map((g:any)=>({id:g.id,tournament:t.name,label:g.label,round:g.round,status:g.status,period:g.period,remaining:g.remaining,runUntil:g.runUntil,teams:g.sources.map((src:any)=>sourceName(stored,t,src)),scores:[total(g,0),total(g,1)]})))});
  if(!isOwner&&!stored.staffEmails.includes(email))return json({error:'Your account is not on the scoring staff list. Ask the dashboard owner to add your email.',email},403);
  const info={user:{email,isOwner},revision:row.revision,state:stored,serverTime:Date.now()};
  if(request.method==='GET')return json(info);
  if(!request.headers.get('content-type')?.includes('application/json'))return json({error:'Use JSON.'},415);
  const bodyText=await request.text();if(new TextEncoder().encode(bodyText).length>12000000)return json({error:'Workspace exceeds the 12 MB limit. Export and delete old tournaments or reports.'},413);
  let data:any;try{data=JSON.parse(bodyText);assertState(data.state);}catch(e){return json({error:e instanceof Error?e.message:'Invalid workspace.'},400);}
  if(!Number.isInteger(data.revision))return json({error:'Missing revision.'},400);
  if(!isOwner&&JSON.stringify(data.state.staffEmails)!==JSON.stringify(stored.staffEmails))return json({error:'Only the owner can change scoring staff access.'},403);
  const encoded=JSON.stringify(data.state),snapshot=crypto.randomUUID(),marker=JSON.stringify({chunked:snapshot});
  const statements=[db.prepare('UPDATE workspaces SET payload = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ?').bind(marker,new Date().toISOString(),'alliance',data.revision),db.prepare('DELETE FROM workspace_chunks WHERE EXISTS (SELECT 1 FROM workspaces WHERE id = ? AND payload = ?)').bind('alliance',marker)];
  for(let i=0;i<encoded.length;i+=300000)statements.push(db.prepare('INSERT INTO workspace_chunks (snapshot, part, content) SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM workspaces WHERE id = ? AND payload = ?)').bind(snapshot,i/300000,encoded.slice(i,i+300000),'alliance',marker));
  const results=await db.batch(statements);
  if(results[0].meta.changes!==1)return json({error:'Another device updated this workspace. Your action was not applied. Refresh and retry.'},409);
  return json({revision:data.revision+1,state:data.state,user:info.user,serverTime:Date.now()});
 }catch(e){console.error('Workspace storage error',e);return json({error:'Online storage is unavailable. Your changes have not been saved. Please retry.'},503);}
}
