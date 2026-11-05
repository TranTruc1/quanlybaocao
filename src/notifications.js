export function mergeNotificationFeed(old,next,{append=false}={}){
 if(!old)return next;const map=new Map((old.items||[]).map(n=>[n.id,n]));for(const n of next.items||[])map.set(n.id,{...n,readAt:n.readAt||map.get(n.id)?.readAt||null,announcedAt:n.announcedAt||map.get(n.id)?.announcedAt||null});
 return {...next,items:[...map.values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id)),nextOffset:append?next.nextOffset:(old.items?.length>100?old.nextOffset:next.nextOffset)};
}
