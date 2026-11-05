const paths={overview:'bao-cao',daily:'dien-bao-cao',orders:'don-hang',targets:'muc-tieu-thang',products:'san-pham',accounts:'nhan-vien',settings:'cau-hinh'};
const pages=Object.fromEntries(Object.entries(paths).map(([key,value])=>[value,key]));
const id=value=>typeof value==='string'&&value.length<=160&&/^[A-Za-z0-9_-]+$/.test(value)?value:null;
const date=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value?value:null;
export function parseAppRoute(hash=''){
 const [path,query='']=hash.replace(/^#/, '').split('?');
 const parts=path.replace(/^\//,'').replace(/\/$/,'').split('/'),area=['user','admin'].includes(parts[0])?parts.shift():null;
 const page=pages[parts.join('/')]||'overview',params=new URLSearchParams(query),base=area?{page,area}:{page};
 if(page==='daily'){
  const report={id:id(params.get('report')),accountId:id(params.get('account')),date:date(params.get('date'))};
  return {...base,report:report.id||report.accountId||report.date?report:null};
 }
 return page==='overview'?{...base,employee:id(params.get('employee')),day:id(params.get('day'))}:base;
}
export function appRouteHash(route){
 const page=paths[route?.page]?route.page:'overview',params=new URLSearchParams();
 if(page==='daily'){
  const r=route.report||{};
  if(id(r.id))params.set('report',r.id);
  if(id(r.accountId))params.set('account',r.accountId);
  if(date(r.date))params.set('date',r.date);
 }else if(page==='overview'){
  if(id(route.employee))params.set('employee',route.employee);
  if(id(route.day))params.set('day',route.day);
 }
 return '#/'+(['user','admin'].includes(route?.area)?route.area+'/':'')+paths[page]+(params.size?'?'+params:'');
}
