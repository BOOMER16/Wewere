from pathlib import Path
import json
p=Path('package-lock.json');data=json.loads(p.read_text(encoding='utf-8-sig'));data['name']='alliance-basketball-dashboard';data['packages']['']['name']='alliance-basketball-dashboard';p.write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8')
for name in ['package.json','.openai/hosting.json']:
 p=Path(name);p.write_text(p.read_text(encoding='utf-8-sig'),encoding='utf-8')
