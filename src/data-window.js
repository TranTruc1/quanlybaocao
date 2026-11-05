export function validRange([from,to]){return /^\d{4}-\d{2}-\d{2}$/.test(from||'')&&/^\d{4}-\d{2}-\d{2}$/.test(to||'')&&Number.isFinite(Date.parse(from))&&Number.isFinite(Date.parse(to))&&new Date(from).toISOString().slice(0,10)===from&&new Date(to).toISOString().slice(0,10)===to&&from<=to&&(new Date(to)-new Date(from))/86400000<=366;}
export function containsRange(scope,range){return !scope||(scope.from<=range[0]&&scope.to>=range[1]);}
export function mergeDelta(db,next){
 if(next?.kind!=='delta')return next;
 if(!db)throw Error('Chưa tải dữ liệu ban đầu.');
 const result={...db,viewer:next.viewer,apiVersion:next.apiVersion};
 for(const key of ['accounts','products','assignments','reports','orders','targets']){
  const deleted=new Set(next.removed?.[key]||[]),map=new Map((db[key]||[]).filter(r=>!deleted.has(r.id)).map(r=>[r.id,r]));
  for(const row of next.upsert?.[key]||[]){const old=map.get(row.id);if(old?.revision&&row.revision&&old.revision>row.revision)continue;map.set(row.id,row);}
  result[key]=[...map.values()];
 }
 result.audit=[];return result;
}
