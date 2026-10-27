import {State,assertState,refreshReport} from './engine';
const same=(a:any,b:any)=>JSON.stringify(a)===JSON.stringify(b);
function merge(base:any,local:any,remote:any,path:string):any{
 if(same(local,remote)||same(base,remote))return local;
 if(same(base,local))return remote;
 // A retried, already-committed scoring event can have since acquired a player.
 if(base===undefined&&local?.id===remote?.id&&local?.type&&local?.at&&same({...local,player:''},{...remote,player:''})&&(!local.player||!remote.player))return {...local,player:local.player||remote.player};
 if(path.endsWith('.savedAt')&&typeof local==='string'&&typeof remote==='string')return local>remote?local:remote;
 if(Array.isArray(base)&&Array.isArray(local)&&Array.isArray(remote)){
 const keyed=(a:any[])=>a.every(x=>x&&typeof x==='object'&&typeof x.id==='string')&&new Set(a.map(x=>x.id)).size===a.length;
 if(keyed(base)&&keyed(local)&&keyed(remote)){
 const ids=[...new Set([...remote.map(x=>x.id),...local.map(x=>x.id)])];
 const out=ids.map(id=>merge(base.find(x=>x.id===id),local.find(x=>x.id===id),remote.find(x=>x.id===id),path+'.'+id)).filter(x=>x!==undefined);
 if(path.endsWith('.events'))out.sort((a,b)=>a.at.localeCompare(b.at));
 return out;
 }
 }
 if(base&&local&&remote&&!Array.isArray(base)&&typeof base==='object'&&typeof local==='object'&&typeof remote==='object'){
 const out:any={};for(const key of new Set([...Object.keys(base),...Object.keys(local),...Object.keys(remote)])){const value=merge(base[key],local[key],remote[key],path+'.'+key);if(value!==undefined)out[key]=value;}return out;
 }
 throw Error('Both operators changed the same item: '+path+'. Review the pending changes.');
}
export function mergeWorkspace(base:State,local:State,remote:State):State{const result=JSON.parse(JSON.stringify(merge(base,local,remote,'workspace'))) as State;for(const t of result.tournaments)for(const g of t.games)if(g.status==='final'&&result.reports.some(r=>r.matchId===g.id))refreshReport(result,t,g);assertState(result);return result;}

