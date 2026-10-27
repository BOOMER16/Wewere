from pathlib import Path
p=Path('app/dashboard.tsx');s=p.read_text(encoding='utf-8-sig');s=s.replace("if(data.revision>=revision.current){", "E.setClockOffset(data.serverTime-Date.now());if(data.revision>=revision.current){")
s=s.replace("<main>{!t?", "<main>{page==='reports'?<ReportsPage key={t?.id||'archive'}/>:!t?")
p.write_text(s,encoding='utf-8')
p=Path('app/reports-page.tsx');s=p.read_text(encoding='utf-8-sig').replace("all||r.tournamentId===t.id", "all||!t||r.tournamentId===t.id");p.write_text(s,encoding='utf-8')
p=Path('lib/engine.ts');s=p.read_text(encoding='utf-8-sig');s=s.replace("export const uid=", "let clockOffset=0;export function setClockOffset(n:number){if(Number.isFinite(n))clockOffset=n;}export const now=()=>Date.now()+clockOffset;\nexport const uid=");s=s.replace("now=Date.now()){return g.runUntil===null?g.remaining:Math.max(0,g.runUntil-now);}", "timestamp=now()){return g.runUntil===null?g.remaining:Math.max(0,g.runUntil-timestamp);}");p.write_text(s,encoding='utf-8')
p=Path('app/score-page.tsx');s=p.read_text(encoding='utf-8-sig').replace('g.runUntil=Date.now()+g.remaining','g.runUntil=E.now()+g.remaining');p.write_text(s,encoding='utf-8')
