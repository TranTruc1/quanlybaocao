const paths={overview:'bao-cao',daily:'dien-bao-cao',orders:'don-hang',targets:'muc-tieu-thang',products:'san-pham',accounts:'nhan-vien',settings:'cau-hinh'};
const pages=Object.fromEntries(Object.entries(paths).map(([key,value])=>[value,key]));
const id=value=>typeof value==='string'&&value.length<=160&&/^[A-Za-z0-9_-]+$/.test(value)?value:null;
const date=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value?value:null;
export function parseAppRoute(hash=''){
 const [path,query='']=hash.replace(/^#/, '').split('?');
 const parts=path.replace(/^\//,'').replace(/\/$/,'').split('/'),area=['user','admin','sale'].includes(parts[0])?parts.shift():null;
 const page=pages[parts.join('/')]||'overview',params=new URLSearchParams(query),base=area?{page,area}:{page};
 if(page==='overview'&&params.get('team')==='sale')base.team='sale';
 if(page==='daily'){
  const report={id:id(params.get('report')),accountId:id(params.get('account')),date:date(params.get('date'))};
  return {...base,report:report.id||report.accountId||report.date?report:null};
 }
 if(['orders','products','accounts','targets'].includes(page)){const focus=id(params.get('focus'));if(focus)base.focus=focus;if(date(params.get('date')))base.date=params.get('date');if(id(params.get('account')))base.accountId=params.get('account');if(/^\d{4}-(0[1-9]|1[0-2])$/.test(params.get('month')||''))base.month=params.get('month');}
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
  if(route.team==='sale')params.set('team','sale');
  if(id(route.employee))params.set('employee',route.employee);
  if(id(route.day))params.set('day',route.day);
 }
 if(['orders','products','accounts','targets'].includes(page)){if(id(route.focus))params.set('focus',route.focus);if(date(route.date))params.set('date',route.date);if(id(route.accountId))params.set('account',route.accountId);if(/^\d{4}-(0[1-9]|1[0-2])$/.test(route.month||''))params.set('month',route.month);}
 return '#/'+(['user','admin','sale'].includes(route?.area)?route.area+'/':'')+paths[page]+(params.size?'?'+params:'');
}
