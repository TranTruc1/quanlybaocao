import {createEngine,TABLES,sha} from './engine.js';
import {connection} from './mongodb.js';
const readActions=new Set(['bootstrap','notifications','reportHistory']);
function fail(message,code){throw Object.assign(Error(message),{code});}
async function loginLimit(db,req,ip){
 const bucket=Math.floor(Date.now()/900000);
 for(const [kind,value,limit] of [['account',String(req.payload?.username||'').trim().toLowerCase(),6],['ip',ip,30]]){
  const r=await db.collection('RateLimits').findOneAndUpdate({_id:sha(kind+'|'+value+'|'+bucket)},{$inc:{count:1},$setOnInsert:{expiresAt:new Date((bucket+2)*900000)}},{upsert:true,returnDocument:'after'});
  if(r.count>limit)fail('Đăng nhập nhiều lần. Thử lại sau 15 phút.','RATE_LIMITED');
 }
}
export async function handleRequest(req,{ip='unknown'}={}){
 if(!req||typeof req.action!=='string'||!req.payload||typeof req.payload!=='object'||Array.isArray(req.payload))fail('Yêu cầu không hợp lệ.','VALIDATION_ERROR');
 const {client,db}=await connection();
 if(req.action==='login')await loginLimit(db,req,ip);
 const session=client.startSession();
 try{return await session.withTransaction(async()=>{
  const opts={session,projection:{_id:0}};
  // Mutations take one shared document write before reading their snapshot.
  // Conflicts retry the entire transaction, including balance validation.
  if(!readActions.has(req.action)){
   const lock=await db.collection('_meta').updateOne({_id:'write-sequence'},{$inc:{version:1}},{session});
   if(!lock.matchedCount)fail('Chạy npm run db:setup trước khi sử dụng database.','NOT_CONFIGURED');
  }
  let actor;
  if(req.action!=='login'){
   if(typeof req.token!=='string'||!req.token||req.token.length>200)fail('Vui lòng đăng nhập.','UNAUTHENTICATED');
   const token=await db.collection('Sessions').findOne({id:sha(req.token)},opts);
   if(!token||token.expires<Date.now())fail('Phiên đăng nhập hết hạn.','UNAUTHENTICATED');
   actor=await db.collection('Accounts').findOne({id:token.accountId,active:true},opts);
   if(!actor||actor.deletedAt)fail('Account không hoạt động.','UNAUTHENTICATED');
  }
  if(req.action==='notifications'){
   const offset=Number(req.payload.offset||0);
   if(!Number.isInteger(offset)||offset<0||offset>1000000)fail('Trang thông báo không hợp lệ.','VALIDATION_ERROR');
   const feedRows=await db.collection('Notifications').find({recipientId:actor.id},opts).sort({createdAt:-1,id:-1}).skip(offset).limit(101).toArray();
   const reportrequests=await db.collection('ReportRequests').find(actor.role==='admin'?{status:'pending'}:{accountId:actor.id,status:'pending'},opts).toArray();
   return {items:feedRows.slice(0,100),nextOffset:feedRows.length>100?offset+100:null,unreadCount:await db.collection('Notifications').countDocuments({recipientId:actor.id,readAt:null},{session}),reportrequests};
  }
  const initial={};
  const rows=async(table,filter={})=>db.collection(table).find(filter,opts).toArray();
  // No concurrent operations inside a MongoDB transaction.
  initial.Accounts=await rows('Accounts');initial.Products=await rows('Products');initial.Assignments=await rows('Assignments');
  const loadActor=actor||(req.action==='login'?initial.Accounts.find(a=>a.username.toLowerCase()===String(req.payload.username||'').trim().toLowerCase()):null);
  const accountFilter=loadActor&&loadActor.role!=='admin'?{accountId:loadActor.id}:{};
  let receipt=null;
  if(req.requestId&&actor)receipt=await db.collection('Audit').findOne({actorId:actor.id,action:'requestCompleted','details.requestId':req.requestId},opts);
  const appointmentMutation=req.action==='saveAppointment';
  const appointmentBefore=appointmentMutation&&req.payload.id?await db.collection('Appointments').findOne({id:req.payload.id},opts):null;
  const appointmentDates=[req.payload.date,appointmentBefore?.date].filter(Boolean);
  const isBootstrap=['login','bootstrap'].includes(req.action);
  const scope=isBootstrap?createEngine({}).window(req.payload):null;
  if(scope){
   initial.Reports=await rows('Reports',{...accountFilter,date:{$gte:scope.from,$lte:scope.to}});
   // Fetch one preceding balance per product/account rather than the full history.
   const balances=await db.collection('Reports').aggregate([
    {$match:{...accountFilter,date:{$lt:scope.from},$or:[{status:'submitted'},{postedEntries:{$type:'array'}}]}},
    {$set:{_carryEntries:{$cond:[{$eq:['$status','submitted']},'$entries','$postedEntries']}}},
    {$unwind:'$_carryEntries'},{$sort:{date:-1}},
    {$group:{_id:{accountId:'$accountId',productId:'$_carryEntries.productId'},r:{$first:{id:'$id',accountId:'$accountId',date:'$date',revision:'$revision',entry:'$_carryEntries'}}}}
   ],{session}).toArray();
   const contexts=new Map();for(const {r} of balances){
    if(!contexts.has(r.id))contexts.set(r.id,{id:r.id,accountId:r.accountId,date:r.date,revision:r.revision,status:'submitted',_normalized:true,_carryContext:true,entries:[]});
    contexts.get(r.id).entries.push({productId:r.entry.productId,remaining:Number(r.entry.remaining||0),budget:Number(r.entry.remaining||0)});
   }
   initial.Reports.push(...contexts.values());
  }else initial.Reports=await rows('Reports',appointmentMutation?{date:{$in:appointmentDates}}:accountFilter);
  const appointmentFilter=scope?{date:{$gte:scope.from,$lte:scope.to},...(loadActor&&loadActor.role!=='admin'?(loadActor.role==='sale'?{saleAccountId:loadActor.id}:{accountId:loadActor.id}):{})}:{};
  initial.Appointments=await rows('Appointments',appointmentFilter);
  initial.ReportRequests=await rows('ReportRequests',accountFilter);
  let orderFilter={};
  if(isBootstrap){
   orderFilter={date:{$gte:scope.from,$lte:scope.to}};
   if(loadActor&&loadActor.role!=='admin')Object.assign(orderFilter,loadActor.role==='sale'?{saleAccountId:loadActor.id}:{accountId:loadActor.id});
  }else{
   const dates=new Set([req.payload.date,...(Array.isArray(req.payload.rows)?req.payload.rows.map(r=>r.date):[])].filter(x=>typeof x==='string'));
   const existing=typeof req.payload.id==='string'?await db.collection('Orders').findOne({id:req.payload.id},opts):null;
   if(existing)dates.add(existing.date);
   const ids=receipt?.details?.changes?.Orders||[];
   orderFilter={$or:[{date:{$in:[...dates]}},{id:{$in:ids}}]};
  }
  initial.Orders=await rows('Orders',orderFilter);
  initial.Targets=await rows('Targets',{...accountFilter,...(scope?{month:{$gte:scope.from.slice(0,7),$lte:scope.to.slice(0,7)}}:{})});
  const sessionAccounts=[actor?.id,req.payload.id].filter(x=>typeof x==='string');
  initial.Sessions=await rows('Sessions',{accountId:{$in:sessionAccounts}});
  let auditFilter={id:{$in:[]}};
  if(req.action==='reportHistory'&&actor){const report=initial.Reports.find(r=>r.id===req.payload.id);if(report&&(actor.role==='admin'||report.accountId===actor.id))auditFilter={'details.reportId':req.payload.id};}
  else if(actor)auditFilter={actorId:actor.id,$or:[{'details.requestId':req.requestId||'__none'},{'details.batchId':req.payload.batchId||'__none'}]};
  initial.Audit=await rows('Audit',auditFilter);
  const offset=Number(req.payload.offset||0);
  if(!Number.isInteger(offset)||offset<0||offset>1000000)fail('Trang không hợp lệ.','VALIDATION_ERROR');
  // Only the recipient's visible page and explicitly acknowledged IDs are loaded.
  initial.Notifications=actor?await db.collection('Notifications').find({recipientId:actor.id},opts).sort({createdAt:-1,id:-1}).limit(offset+101).toArray():[];
  if(actor&&req.action==='ackNotifications'&&Array.isArray(req.payload.ids)){
   const extra=await rows('Notifications',{recipientId:actor.id,id:{$in:req.payload.ids}});
   initial.Notifications=[...new Map([...initial.Notifications,...extra].map(r=>[r.id,r])).values()];
  }
  const engine=createEngine(initial),result=engine.execute(req),changes=engine.changes();
  for(const table of TABLES){
   const deleted=new Set(changes.removed[table]||[]),changed=new Set(changes.changes[table]||[]);
   const operations=[...deleted].map(id=>({deleteOne:{filter:{id}}}));
   for(const r of engine.rows(table))if(changed.has(r.id)&&!deleted.has(r.id)){
    if(table==='Sessions')r.expireAt=new Date(r.expires);
    operations.push({replaceOne:{filter:{id:r.id},replacement:r,upsert:true}});
   }
   if(operations.length)await db.collection(table).bulkWrite(operations,{session,ordered:true});
  }
  const viewer=actor||result?.user;
  if(viewer){
   const currentOffset=req.action==='notifications'?offset:0;
   const feedRows=await db.collection('Notifications').find({recipientId:viewer.id},opts).sort({createdAt:-1,id:-1}).skip(currentOffset).limit(101).toArray();
   const reportrequests=await db.collection('ReportRequests').find(viewer.role==='admin'?{status:'pending'}:{accountId:viewer.id,status:'pending'},opts).toArray();
   const feed={items:feedRows.slice(0,100),nextOffset:feedRows.length>100?currentOffset+100:null,unreadCount:await db.collection('Notifications').countDocuments({recipientId:viewer.id,readAt:null},{session}),reportrequests};
   if(['notifications','ackNotifications'].includes(req.action))return feed;
   if(result?.db)result.db.notifications=feed;else if(result&&typeof result==='object')result.notifications=feed;
  }
  if(viewer&&(isBootstrap||['saveReport','deleteReport','changeReportDate'].includes(req.action))){
   const dates=await db.collection('Reports').aggregate([
    {$match:viewer.role==='admin'?{}:{accountId:viewer.id}},
    {$unwind:'$entries'},
    {$group:{_id:{accountId:'$accountId',productId:'$entries.productId'},first:{$min:'$date'},last:{$max:'$date'}}}
   ],{session}).toArray();
   const target=result?.db||result;
   target.reportDateBounds=dates.map(r=>({...r._id,first:r.first,last:r.last}));
  }
  return result;
 },{readConcern:{level:'snapshot'},writeConcern:{w:'majority'},maxCommitTimeMS:10000});}
 finally{await session.endSession();}
}
