// Domain rules ported from the existing backend. A new isolated engine per request.
import {appointmentCount} from '../src/appointments.js';
import {sessionMaxAge} from './session-policy.js';
import {createHash,randomUUID} from 'node:crypto';
import {passwordRecord,passwordDigest,equalSecret} from './passwords.js';
import {normalizeBudgets} from '../src/budget-transfers.js';
export const TABLES=['Accounts','Products','Assignments','Reports','Orders','Appointments','Targets','Sessions','Audit','Notifications','ReportRequests','TargetRequests'];
export const sha=s=>createHash('sha256').update(s).digest('base64').replaceAll('+','-').replaceAll('/','_');
export function createEngine(initial={},options={}){
 var FIELDS_=['budget','remaining','data','tt','ktt','success','upsale','appointments','late'];
 const tables=Object.fromEntries(TABLES.map(k=>[k,new Map((initial[k]||[]).map(r=>[r.id,structuredClone(r)]))]));
 var REQUEST_={changes:{},removed:{},before:{},idSeed:'',idCounter:0};
 function read_(name){return [...tables[name].values()].map(r=>structuredClone(r));}
 function get_(name,id){return structuredClone(tables[name].get(id)||null);}
 function put_(name,r){
  if(!r||typeof r.id!=='string'||!r.id||r.id.length>100||JSON.stringify(r).length>200000)throw applicationError_('Bản ghi không hợp lệ hoặc quá lớn.');
  rememberBefore_(name,r.id,get_(name,r.id));tables[name].set(r.id,structuredClone(r));
  if(!(REQUEST_.changes[name]||=[]).includes(r.id))REQUEST_.changes[name].push(r.id);
 }
 function remove_(name,id){if(!tables[name].has(id))return;rememberBefore_(name,id,get_(name,id));tables[name].delete(id);(REQUEST_.removed[name]||=[]).push(id);}
 function now_(){return new Date().toISOString();}
 function uuid_(){return randomUUID();}
 function sha_(s){return sha(s);}
 function newId_(){return REQUEST_.idSeed?'sl_'+sha_(REQUEST_.idSeed+'|'+REQUEST_.idCounter++).replace(/=+$/,''):uuid_();}
 function audit_(actor,action,details){put_('Audit',{id:uuid_(),actorId:actor,action,details,time:now_()});}
 const passwordRecord_=passwordRecord,passwordDigest_=passwordDigest,equal_=equalSecret;
 function careOrder_(o){return o.type==='care'||o.type==='upsale'||o.isCare===true;}
 function weightOrder_(o){return o.isSplit===true?0.5:1;}
 function normalizeReportBudgets_(reports){try{return normalizeBudgets(reports);}catch(e){throw applicationError_(e.message);}}
function mutate_(action,p,user,sessionId){
  if(extraMutation_(action,p,user))return;
  if(action==='saveReport') {
    date_(p.date);var accountId=owner_(p.accountId,user);var account=get_('Accounts',accountId);if(!account||!account.active)throw Object.assign(new Error('Account không hoạt động.'),{code:'UNAUTHENTICATED'});
    if(!['draft','submitted'].includes(p.status)||!Array.isArray(p.entries)||p.entries.length<1||p.entries.length>100)throw applicationError_('Bảng nhập không hợp lệ.');
    var old=read_('Reports').find(function(r){return r.accountId===accountId&&r.date===p.date;});

    checkReportSequence_(accountId,p.date,user);
    
    if(old&&old.status==='submitted'&&p.status==='draft')p.status='submitted';
    if(old&&old.revision!==Number(p.revision))throw applicationError_('Bảng đã được cập nhật. Tải lại trước khi sửa.');
    var ids=Object.create(null);var entries=p.entries.map(function(e){
      if(ids[e.productId])throw applicationError_('Sản phẩm bị trùng trong bảng.');ids[e.productId]=true;
      var previousEntry=old&&old.entries.find(function(x){return x.productId===e.productId;});var unchanged=previousEntry&&old.status==='submitted'&&Object.prototype.hasOwnProperty.call(e,'received')===Object.prototype.hasOwnProperty.call(previousEntry,'received')&&['received','budget','remaining','data','tt','ktt','appointments','late'].every(function(k){return Number(e[k]||0)===Number(previousEntry[k]||0);});if(!(previousEntry&&user.role==='admin')&&!unchanged)checkProduct_(accountId,e.productId);var clean={productId:e.productId};
      FIELDS_.forEach(function(k){clean[k]=k==='ktt'?0:num_(e[k],!['budget','remaining','success','upsale'].includes(k));});
      ['success','upsale'].forEach(function(k){if(!Number.isInteger(clean[k]*2))throw applicationError_('So don phai theo buoc 0,5.');});
      if(clean.tt>clean.data)throw applicationError_('Data tương tác không thể vượt Tổng data.');clean.ktt=clean.data-clean.tt;
      if(account.role==='sale'){clean.budget=0;clean.remaining=0;clean.late=0;delete clean.received;}
      clean.appointments=appointmentCount(read_('Appointments'),accountId,p.date,e.productId,account.role,previousEntry?.appointments||0);
      var matchingOrders=read_('Orders').filter(function(o){return (account.role==='sale'?o.saleAccountId===accountId:o.accountId===accountId)&&o.productId===e.productId&&o.date===p.date&&!o.isBounced;});
      clean.success=matchingOrders.filter(function(o){return !careOrder_(o);}).reduce(function(n,o){return n+weightOrder_(o);},0);
      clean.upsale=matchingOrders.filter(function(o){return o.type==='upsale';}).reduce(function(n,o){return n+weightOrder_(o);},0);
      if(account.role!=='sale'&&Object.prototype.hasOwnProperty.call(e,'received')){clean.received=num_(e.received,false);}else if(clean.remaining>clean.budget)throw applicationError_('Thừa cuối ngày không thể vượt ngân sách.');return clean;
    });
    if(user.role!=='admin'&&old&&old.entries.some(function(e){return !ids[e.productId];}))throw applicationError_('Không được bỏ sản phẩm đã có trong báo cáo. Không phát sinh vẫn giữ dòng số 0.');
    if(user.role!=='admin'&&p.status==='submitted'&&(!old||(old.status==='draft'&&!old.postedEntries))){var required=read_('Assignments').filter(function(a){return a.accountId===accountId&&a.active&&get_('Products',a.productId)?.active;});if(required.some(function(a){return !ids[a.productId];}))throw applicationError_('Cần điền đủ sản phẩm được giao. Không phát sinh vẫn gửi số 0.');}
    var proposed={transfers:validateTransfers_(p,old,accountId,user,entries),id:old?old.id:newId_(),accountId:accountId,date:p.date,status:p.status,entries:entries,revision:(old?old.revision:0)+1,updatedAt:now_(),submittedAt:p.status==='submitted'?(old&&old.submittedAt?old.submittedAt:now_()):(old?old.submittedAt:null),postedEntries:p.status==='draft'&&old?old.postedEntries:null};
    writeReportBudgets_(read_('Reports').filter(function(r){return r.id!==proposed.id;}).concat([proposed]),proposed.id,user);
    completeRequests_(accountId,p.date,user);
  } else if(action==='changeReportDate') {
    throw Object.assign(new Error('Không thể đổi ngày báo cáo đã lưu.'),{code:'FORBIDDEN'});
  } else if(action==='reopen') {
    admin_(user);var r=get_('Reports',p.id);if(!r)throw applicationError_('Không tìm thấy bảng.');var beforeReopen=JSON.parse(JSON.stringify(r));r.postedEntries=JSON.parse(JSON.stringify(r.entries));r.status='draft';r.revision++;r.updatedAt=now_();put_('Reports',r);audit_(user.id,'reportReopened',{reportId:r.id,accountId:r.accountId,before:beforeReopen,after:r});
  } else if(action==='saveOrder') {
    put_('Orders',prepareOrder_(p,user));
  } else if(action==='saveOrdersBulk'||action==='saveProductsBulk') {
    var productBatch=action==='saveProductsBulk';if(productBatch)admin_(user);
    if(!Array.isArray(p.rows)||p.rows.length<1||p.rows.length>50||typeof p.batchId!=='string'||!/^[a-zA-Z0-9_-]{8,100}$/.test(p.batchId))throw applicationError_('Lô không hợp lệ; tối đa 50 dòng.');
    var fingerprint=sha_(JSON.stringify(p.rows));var saved=read_('Audit').find(function(a){return a.actorId===user.id&&a.action==='batchSaved'&&a.details.batchId===p.batchId;});
    if(saved){if(saved.details.fingerprint!==fingerprint)throw applicationError_('Lô này đã lưu với nội dung khác. Tải lại danh sách trước khi tạo lô mới.');return;}
    var assignmentPlans=[],seenNames=Object.create(null);var records=p.rows.map(function(row,index){
      try{if(row.id)throw applicationError_('Lô chỉ dùng thêm mới.');var record=productBatch?prepareProduct_(row,user):prepareOrder_(Object.assign({},row,{confirmDuplicate:p.confirmDuplicate===true}),user);if(productBatch){assignmentPlans=assignmentPlans.concat(prepareProductAssignments_(row,record.id));var name=record.name.toLowerCase();if(seenNames[name])throw applicationError_('Tên sản phẩm trùng trong lô.');seenNames[name]=true;}return record;}
      catch(e){throw Object.assign(new Error('Dòng '+(index+1)+': '+e.message),{code:e.code});}
    });
    if(!productBatch&&!p.confirmDuplicate){var batchCustomers=Object.create(null);records.forEach(function(r){var key=customerKey_(r.customerName,r.date);if(batchCustomers[key])throw duplicateOrder_();batchCustomers[key]=true;});}
    records.forEach(function(r){put_(productBatch?'Products':'Orders',r);});assignmentPlans.forEach(function(a){put_('Assignments',a);});
    audit_(user.id,'batchSaved',{batchId:p.batchId,fingerprint:fingerprint,count:records.length,table:productBatch?'Products':'Orders'});
  } else if(action==='deleteOrder') {
    var o=get_('Orders',p.id);if(!o)throw applicationError_('Không tìm thấy đơn.');if(user.role!=='admin'&&o.accountId!==user.id&&o.saleAccountId!==user.id)throw applicationError_('Không có quyền xóa đơn.');remove_('Orders',p.id);
  } else if(action==='saveProduct') {
    var product=prepareProduct_(p,user),assignments=prepareProductAssignments_(p,product.id);put_('Products',product);assignments.forEach(function(a){put_('Assignments',a);});
  } else if(action==='changePassword') {
   var currentPassword=String(p.currentPassword||''),nextPassword=String(p.newPassword||'');
   if(nextPassword.length<6||nextPassword.length>20)throw applicationError_('Mật khẩu mới cần 6–20 ký tự.');
   if(nextPassword===currentPassword)throw applicationError_('Mật khẩu mới phải khác mật khẩu hiện tại.');
   var account=get_('Accounts',user.id);
   if(!account||!account.passwordHash)throw applicationError_('Account chưa đặt mật khẩu. Liên hệ admin để đặt lại.');
   var digest;
   try{digest=passwordDigest_(currentPassword,account);}catch(e){throw applicationError_('Mật khẩu hiện tại không đúng.');}
   if(!equal_(digest,account.passwordHash))throw applicationError_('Mật khẩu hiện tại không đúng.');
   Object.assign(account,passwordRecord_(nextPassword));account.revision=(account.revision||0)+1;put_('Accounts',account);
   read_('Sessions').filter(function(s){return s.accountId===account.id&&s.id!==sessionId;}).forEach(function(s){remove_('Sessions',s.id);});
  } else if(action==='saveAccount') {
    admin_(user);var old=p.id?get_('Accounts',p.id):null;if(p.id&&!old)throw applicationError_('Không tìm thấy account.');
    if(old&&old.deletedAt)throw applicationError_('Khôi phục account trước khi chỉnh sửa.');checkAccount_(p,!old);if(old&&Number(p.revision||0)!==Number(old.revision||0))throw conflict_();var username=String(p.username).trim();
    var nextRole=p.role===undefined?(old?old.role:'user'):p.role;
    if(['admin','user','sale'].indexOf(nextRole)<0)throw applicationError_('Role phải là admin, user (MKT) hoặc sale (SALE).');
    if(old&&old.role==='admin'&&old.active&&nextRole!=='admin'&&read_('Accounts').filter(function(a){return a.role==='admin'&&a.active;}).length<=1)throw applicationError_('Không thể hạ quyền admin cuối cùng đang hoạt động.');
    if(read_('Accounts').some(function(a){return a.username.toLowerCase()===username.toLowerCase()&&a.id!==p.id;}))throw applicationError_('Tên đăng nhập đã tồn tại.');
    var nextPriority=Object.prototype.hasOwnProperty.call(p,'priority')?(p.priority===''||p.priority===null||p.priority===undefined?null:Number(p.priority)):(old?old.priority:undefined);
    if(nextPriority!==null&&nextPriority!==undefined&&(!Number.isInteger(nextPriority)||nextPriority<1||nextPriority>1000))throw applicationError_('Thứ tự hiển thị phải là số nguyên từ 1 trở lên.');
    var record=Object.assign({},old||{id:newId_(),role:'user',active:true},{username:username,ownerName:p.ownerName.trim(),role:nextRole,priority:nextPriority,revision:(old?old.revision||0:0)+1});
    if(p.password)Object.assign(record,passwordRecord_(p.password));put_('Accounts',record);
    if(Number.isFinite(record.priority)){var bumpNext=record.priority;var bumpOthers=read_('Accounts').filter(function(a){return a.id!==record.id&&Number.isFinite(a.priority);}).sort(function(a,b){return a.priority-b.priority;});for(var bumpI=0;bumpI<bumpOthers.length;bumpI++){var bumped=bumpOthers[bumpI];if(bumped.priority===bumpNext){bumped.priority=bumpNext+1;bumped.revision=(bumped.revision||0)+1;put_('Accounts',bumped);bumpNext=bumped.priority;}else if(bumped.priority>bumpNext)break;}}
    if(old&&(p.password||old.role!==nextRole))read_('Sessions').filter(function(s){return s.accountId===old.id;}).forEach(function(s){remove_('Sessions',s.id);});
    if(old&&old.role!==nextRole)audit_(user.id,'roleChanged',{accountId:record.id,beforeRole:old.role,afterRole:nextRole});
  } else if(action==='deleteAccount'||action==='restoreAccount') {
    admin_(user);var target=get_('Accounts',p.id);if(!target||!employeeRole_(target.role)||target.id===user.id)throw applicationError_('Chỉ được xóa hoặc khôi phục tài khoản user.');
    if(action==='deleteAccount'){
      target.active=false;target.deletedAt=now_();put_('Accounts',target);
      read_('Sessions').filter(function(s){return s.accountId===target.id;}).forEach(function(s){remove_('Sessions',s.id);});
      read_('Assignments').filter(function(a){return a.accountId===target.id&&a.active;}).forEach(function(a){a.active=false;a.updatedAt=now_();put_('Assignments',a);});
    }else{target.active=true;target.deletedAt=null;put_('Accounts',target);}
    audit_(user.id,action,{accountId:target.id,username:target.username});
  } else if(action==='assignBulk') {
    admin_(user);if(!Array.isArray(p.changes)||!p.changes.length||p.changes.length>500)throw applicationError_('Chọn từ 1 đến 500 ô phân phối để lưu.');
    var allAssignments=read_('Assignments'),pairs=Object.create(null),fingerprint=sha_(JSON.stringify(p.changes)),seed=REQUEST_.idSeed||newId_();
    // Validate the entire batch before staging any write. Base values prevent stale admin tabs from overwriting a newer save.
    var plans=p.changes.map(function(row){
      if(!row||typeof row.accountId!=='string'||typeof row.productId!=='string'||typeof row.active!=='boolean'||typeof row.baseActive!=='boolean')throw applicationError_('Dữ liệu phân phối không hợp lệ.');
      var key=JSON.stringify([row.accountId,row.productId]);if(pairs[key])throw applicationError_('Ô phân phối bị trùng.');pairs[key]=true;
      var account=get_('Accounts',row.accountId),product=get_('Products',row.productId);
      if(!account||!account.active||account.deletedAt||!employeeRole_(account.role)||!product||!product.active)throw applicationError_('Nhân viên hoặc sản phẩm đã thay đổi. Tải lại và kiểm tra phân phối.');
      var old=allAssignments.find(function(a){return a.accountId===row.accountId&&a.productId===row.productId;});
      if(old&&old.assignmentRequest===seed){if(old.assignmentFingerprint!==fingerprint||old.active!==row.active)throw applicationError_('Yêu cầu phân phối đã dùng với dữ liệu khác.');return old;}
      if((old?old.id:null)!==row.baseId||(old?old.updatedAt||null:null)!==row.baseUpdatedAt||(old?old.active===true:false)!==row.baseActive)throw conflict_();
      return {id:old?old.id:newId_(),accountId:row.accountId,productId:row.productId,active:row.active,updatedAt:now_(),assignmentRequest:seed,assignmentFingerprint:fingerprint};
    });
    plans.forEach(function(a){put_('Assignments',a);});
  } else if(action==='assign') {
    admin_(user);var account=get_('Accounts',p.accountId),product=get_('Products',p.productId);if(!account||!account.active||!employeeRole_(account.role)||!product||!product.active)throw applicationError_('Account hoặc sản phẩm không hợp lệ.');
    var old=read_('Assignments').find(function(a){return a.accountId===p.accountId&&a.productId===p.productId;});put_('Assignments',{id:old?old.id:newId_(),accountId:p.accountId,productId:p.productId,active:p.active===true,updatedAt:now_()});
  } else if(action==='saveTargets') {
    p.accountId=owner_(p.accountId,user);if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(p.month))throw applicationError_('Tháng mục tiêu chưa hợp lệ.');var salary=num_(p.salary,false);if(!Array.isArray(p.targets)||p.targets.length<1||p.targets.length>100)throw applicationError_('Mục tiêu chưa hợp lệ.');
    if(!get_('Accounts',p.accountId))throw applicationError_('Không tìm thấy account.');
    var existing=read_('Targets');var ids=Object.create(null);var records=p.targets.map(function(t){if(ids[t.productId])throw applicationError_('Sản phẩm mục tiêu bị trùng.');ids[t.productId]=true;var product=get_('Products',t.productId);if(!product)throw applicationError_('Không tìm thấy sản phẩm.');var old=existing.find(function(x){return x.accountId===p.accountId&&x.productId===t.productId&&x.month===p.month;});if(old&&Number(t.revision||0)!==Number(old.revision||0))throw conflict_();if(!old||user.role!=='admin')checkProduct_(p.accountId,t.productId);return {id:old?old.id:newId_(),revision:(old?old.revision||0:0)+1,accountId:p.accountId,productId:t.productId,month:p.month,revenue:num_(t.revenue,false),care:num_(t.care,false),salary:salary,priceUsd:old?old.priceUsd:product.priceUsd,rate:old?old.rate:product.rate,updatedAt:now_()};});
    records.forEach(function(t){put_('Targets',t);});
    read_('TargetRequests').filter(function(r){return r.accountId===p.accountId&&r.month===p.month&&r.status==='pending';}).forEach(function(r){r.status='completed';r.completedAt=now_();r.completedBy=user.id;r.revision++;put_('TargetRequests',r);});
  } else throw applicationError_('Thao tác không được hỗ trợ.');
}

function visible_(user,scope){
  var db={apiVersion:2,viewer:publicAccount_(user),accounts:read_('Accounts').map(publicAccount_),products:read_('Products'),assignments:read_('Assignments'),reportrequests:read_('ReportRequests').filter(r=>user.role==='admin'||r.accountId===user.id),targetrequests:read_('TargetRequests').filter(r=>user.role==='admin'||r.accountId===user.id),reports:read_('Reports'),orders:read_('Orders'),appointments:read_('Appointments'),targets:read_('Targets'),notifications:notificationFeed_(user,0),audit:scope?[]:(user.role==='admin'?read_('Audit'):[])};
  if(user.role!=='admin'){
    var ownAssignments=db.assignments.filter(function(a){return a.accountId===user.id;}),ownProducts=Object.create(null);
    ownAssignments.filter(function(a){return a.active;}).forEach(function(a){ownProducts[a.productId]=true;});
    var directory=user.role==='sale'?db.accounts.filter(function(a){return a.role==='user'&&((a.active&&db.assignments.some(function(x){return x.active&&x.accountId===a.id&&ownProducts[x.productId];}))||db.appointments.some(o=>o.saleAccountId===user.id&&o.accountId===a.id));}):db.accounts.filter(function(a){return a.role==='sale'&&((a.active&&db.assignments.some(function(x){return x.active&&x.accountId===a.id&&ownProducts[x.productId];}))||db.orders.some(function(o){return o.accountId===user.id&&o.saleAccountId===a.id;})||db.appointments.some(function(o){return o.accountId===user.id&&o.saleAccountId===a.id;}));});
    var directoryIds=directory.map(function(a){return a.id;});
    db.accounts=db.accounts.filter(function(a){return a.id===user.id||directoryIds.includes(a.id);});
    db.assignments=db.assignments.filter(function(a){return a.accountId===user.id||(directoryIds.includes(a.accountId)&&ownProducts[a.productId]&&a.active);});
    db.reports=db.reports.filter(function(r){return r.accountId===user.id;});
    db.targets=db.targets.filter(function(r){return r.accountId===user.id;});
    db.orders=db.orders.filter(function(r){return user.role==='sale'?r.saleAccountId===user.id:r.accountId===user.id;});
    db.appointments=db.appointments.filter(function(r){return user.role==='sale'?r.saleAccountId===user.id:r.accountId===user.id;});
    var ids=Object.create(null);ownAssignments.filter(function(a){return a.active;}).forEach(function(a){ids[a.productId]=true;});db.reports.forEach(function(r){r.entries.forEach(function(e){ids[e.productId]=true;});});db.orders.forEach(function(o){ids[o.productId]=true;});db.appointments.forEach(function(o){ids[o.productId]=true;});db.targets.forEach(function(t){ids[t.productId]=true;});db.products=db.products.filter(function(p){return ids[p.id];});
  }
  if(scope){
    var latest=Object.create(null);
    db.reports.filter(function(r){return r.date<scope.from&&(r.status==='submitted'||r.postedEntries);}).sort(function(a,b){return a.date.localeCompare(b.date);}).forEach(function(r){(r.status==='submitted'?r.entries:r.postedEntries).forEach(function(e){latest[r.accountId+'|'+e.productId]={r:r,e:e};});});
    var contexts=Object.create(null);Object.keys(latest).forEach(function(k){var x=latest[k];if(!contexts[x.r.id])contexts[x.r.id]={id:x.r.id,accountId:x.r.accountId,date:x.r.date,status:'submitted',revision:x.r.revision,_carryContext:true,_normalized:true,entries:[]};contexts[x.r.id].entries.push({productId:x.e.productId,remaining:Number(x.e.remaining||0),budget:Number(x.e.remaining||0)});});
    db.reports=db.reports.filter(function(r){return r.date>=scope.from&&r.date<=scope.to;}).map(function(r){r._normalized=true;return r;}).concat(Object.keys(contexts).map(function(k){return contexts[k];}));
    db.orders=db.orders.filter(function(o){return o.date>=scope.from&&o.date<=scope.to;});db.appointments=db.appointments.filter(function(o){return o.date>=scope.from&&o.date<=scope.to;});
    db.targets=db.targets.filter(function(t){return t.month>=scope.from.slice(0,7)&&t.month<=scope.to.slice(0,7);});db.scope=scope;
  }
  return db;
}
function scope_(p){
  var yesterday=new Date();yesterday.setTime(yesterday.getTime()-86400000);var day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(yesterday);
  var from=p.from||day.slice(0,7)+'-01',to=p.to||day.slice(0,7)+'-'+String(new Date(Number(day.slice(0,4)),Number(day.slice(5,7)),0).getDate()).padStart(2,'0');date_(from);date_(to);
  if(from>to||(new Date(to)-new Date(from))/86400000>36600)throw applicationError_('Chọn khoảng ngày hợp lệ, tối đa 100 năm mỗi lần.');return {from:from,to:to};
}
function delta_(user,changes,removed){
  var result={notifications:notificationFeed_(user,0),kind:'delta',apiVersion:2,viewer:publicAccount_(user),upsert:{},removed:{}};
  ['Accounts','Products','Assignments','Reports','Orders','Appointments','Targets','ReportRequests','TargetRequests'].forEach(function(table){var ids=(changes||{})[table]||[],rows=ids.map(function(id){return get_(table,id);}).filter(Boolean);
    if(user.role!=='admin')rows=rows.filter(function(r){return table==='Accounts'?r.id===user.id:table==='Products'?read_('Assignments').some(function(a){return a.active&&a.accountId===user.id&&a.productId===r.id;}):(table==='Orders'||table==='Appointments')&&user.role==='sale'?r.saleAccountId===user.id:r.accountId===user.id;});
    if(table==='Accounts')rows=rows.map(publicAccount_);if(table==='Reports')rows=rows.map(function(r){r._normalized=true;return r;});
    result.upsert[table.toLowerCase()]=rows;result.removed[table.toLowerCase()]=(removed||{})[table]||[];
  });return result;
}
function applicationError_(message){return Object.assign(new Error(message),{code:/quyền|Chỉ admin|chưa được phân phối|Chỉ được sửa mục tiêu/.test(message)?'FORBIDDEN':'VALIDATION_ERROR'});}
function conflict_(){return Object.assign(new Error('Dữ liệu vừa được người khác cập nhật. Tải lại trước khi sửa.'),{code:'CONFLICT'});}


function requestUser_(req){var user=session_(req.token);if(req.uiRole==='admin'&&user.role!=='admin'){var err=new Error('Không đủ quyền để thực hiện.');err.code='FORBIDDEN';throw err;}return user;}
function session_(token){if(typeof token!=='string'||token.length>200)throw Object.assign(new Error('Vui lòng đăng nhập.'),{code:'UNAUTHENTICATED'});var s=get_('Sessions',sha_(token));if(!s||s.expires<Date.now())throw Object.assign(new Error('Phiên hết hạn. Đăng xuất và đăng nhập lại.'),{code:'UNAUTHENTICATED'});var a=get_('Accounts',s.accountId);if(!a||!a.active)throw Object.assign(new Error('Account không hoạt động.'),{code:'UNAUTHENTICATED'});return a;}
function publicAccount_(a){return {id:a.id,username:a.username,ownerName:a.ownerName,role:a.role,active:a.active,deletedAt:a.deletedAt||null,revision:a.revision||0,priority:Number.isFinite(a.priority)?a.priority:null};}
function owner_(requested,user){if(user.role==='admin'){if(!requested)throw applicationError_('Chọn account.');return requested;}if(requested&&requested!==user.id)throw applicationError_('Không có quyền truy cập account khác.');return user.id;}
function admin_(u){if(u.role!=='admin')throw applicationError_('Chỉ admin có quyền thực hiện.');}
function checkProduct_(accountId,productId){var p=get_('Products',productId);if(!p||!p.active||!read_('Assignments').some(function(a){return a.accountId===accountId&&a.productId===productId&&a.active;}))throw applicationError_('Sản phẩm chưa được phân phối cho account hoặc đã ngừng dùng.');}
function checkAccount_(p,needsPassword){if(String(p.password||'').length>20)throw applicationError_('Mật khẩu tối đa 20 ký tự.');if(!String(p.ownerName||'').trim()||String(p.ownerName).length>100||! /^[a-zA-Z0-9_.-]{2,60}$/.test(String(p.username||'').trim()))throw applicationError_('Kiểm tra tên chủ sở hữu và tên đăng nhập (2–60 ký tự).');if((needsPassword||p.password)&&String(p.password||'').length<6)throw applicationError_('Mật khẩu cần ít nhất 6 ký tự.');}
function num_(v,int){var n=Number(v);if(!Number.isFinite(n)||n<0||n>1e13||(int&&!Number.isInteger(n)))throw applicationError_('Số liệu phải không âm; số đếm phải là số nguyên.');return n;}
function date_(v){if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||new Date(v+'T00:00:00Z').toISOString().slice(0,10)!==v)throw applicationError_('Ngày không hợp lệ.');}

function reportWindow_(){
 var today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 var d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-1);var to=d.toISOString().slice(0,10);d.setUTCDate(d.getUTCDate()-6);return {from:d.toISOString().slice(0,10),to:to};
}
function checkReportSequence_(accountId,date,actor,excludeId){
 if(actor.role==='admin'||read_('ReportRequests').some(r=>r.accountId===accountId&&r.date===date&&r.status==='pending'))return; // Admin can correct historical reports; every change is audited.
 var window=reportWindow_();
 if(date<window.from||date>window.to)throw applicationError_('Chỉ nhập và sửa báo cáo từ '+window.from+' đến '+window.to+' (7 ngày gần nhất, tính đến hôm qua).');
 var own=read_('Reports').filter(function(r){return r.accountId===accountId;}).sort(function(a,b){return a.date.localeCompare(b.date);});
 if(!own.length)return;
 var start=own[0].date>window.from?own[0].date:window.from;
 if(date<start)throw applicationError_('Ngày bắt đầu báo cáo của account là '+start+'. Không thể thêm ngày trước mốc này.');
 var d=new Date(start+'T12:00:00Z');
 while(d.toISOString().slice(0,10)<date){var day=d.toISOString().slice(0,10);
  if(!own.some(function(r){return r.id!==excludeId&&r.date===day&&r.status==='submitted';}))throw applicationError_('Cần gửi báo cáo ngày '+day+' trước khi điền ngày tiếp theo. Không phát sinh vẫn gửi các ô bằng 0; bản nháp chưa được tính.');
  d.setUTCDate(d.getUTCDate()+1);
 }
}


function writeReportBudgets_(proposed,primaryId,actor){
  var old=read_('Reports');
  var normalized=normalizeReportBudgets_(proposed);
  normalized.forEach(function(r){
    var previous=old.find(function(x){return x.id===r.id;});
    if(previous&&JSON.stringify(previous)===JSON.stringify(r))return;
    if(previous&&r.id!==primaryId){r.revision=(previous.revision||0)+1;r.updatedAt=now_();}
    put_('Reports',r);
    if(actor)audit_(actor.id,previous?(r.id===primaryId?'reportUpdated':'carryoverRecomputed'):'reportCreated',{reportId:r.id,accountId:r.accountId,before:previous||null,after:r});
  });
}

function employeeRole_(role){return role==='user'||role==='sale';}
function customerKey_(name,date){return date+'|'+String(name||'').normalize('NFC').trim().replace(/\s+/g,' ').toLowerCase();}
function duplicateOrder_(){return Object.assign(new Error('Đã có đơn trùng tên khách và cùng ngày (trong hệ thống hoặc trong lô). Bạn có chắc chắn muốn lưu thêm?'),{code:'DUPLICATE_ORDER'});}
function prepareOrder_(p,user){
    date_(p.date);var old=p.id?get_('Orders',p.id):null;
    if(p.id&&!old)throw applicationError_('Đơn không còn tồn tại.');
    if(old&&user.role!=='admin'&&old.accountId!==user.id&&old.saleAccountId!==user.id)throw applicationError_('Không có quyền sửa đơn.');
    if(old&&Number(p.revision||0)!==Number(old.revision||0))throw conflict_();
    var accountId=user.role==='sale'?String(p.accountId||''):owner_(p.accountId,user);
    var mkt=get_('Accounts',accountId);if(!mkt||!['user','admin'].includes(mkt.role)||!mkt.active)throw applicationError_('Chọn MKT hoặc Admin đang hoạt động để nhận đơn.');
    if(user.role==='sale')checkProduct_(user.id,p.productId);
    if(mkt.role!=='admin'&&!(user.role==='admin'&&old&&old.accountId===accountId&&old.productId===p.productId))checkProduct_(accountId,p.productId);
    var saleAccountId=old?old.saleAccountId||null:user.role==='sale'?user.id:null;
    if(user.role!=='sale'&&Object.prototype.hasOwnProperty.call(p,'saleAccountId')){saleAccountId=p.saleAccountId||null;if(saleAccountId&&(!old||saleAccountId!==old.saleAccountId||accountId!==old.accountId||p.productId!==old.productId)){var sales=get_('Accounts',saleAccountId);if(!sales||sales.role!=='sale'||!sales.active)throw applicationError_('SALE phụ trách không hợp lệ.');checkProduct_(saleAccountId,p.productId);}}
    var customer=String(p.customerName||'').trim();if(!customer||customer.length>200)throw applicationError_('Tên khách chưa hợp lệ.');
    var orderId=old?old.id:newId_();
    var changed=!old||customerKey_(old.customerName,old.date)!==customerKey_(customer,p.date);
    if(changed&&p.confirmDuplicate!==true&&read_('Orders').some(function(o){return o.id!==orderId&&customerKey_(o.customerName,o.date)===customerKey_(customer,p.date);}))throw duplicateOrder_();
    if(!['sale','care','upsale'].includes(p.type))throw applicationError_('Loại doanh thu chưa hợp lệ.');
    if(p.isCare!==undefined && typeof p.isCare!=='boolean')throw applicationError_('Danh dau cham khong hop le.');
    if(p.isBounced!==undefined&&typeof p.isBounced!=='boolean')throw applicationError_('Đánh dấu bùng không hợp lệ.');if(!old&&p.isBounced)throw applicationError_('Chỉ đánh dấu bùng khi sửa đơn.');
    if(p.isSplit!==undefined && typeof p.isSplit!=='boolean')throw applicationError_('Danh dau chia khong hop le.');
    if(p.amountUsd===''||p.amountUsd===undefined||p.amountUsd===null)throw applicationError_('Nhap so tien thuc te cua don hang.');
    var usd=num_(p.amountUsd,false),rate=num_(p.rate,false);if(rate<=0)throw applicationError_('Tỷ giá phải lớn hơn 0.');
    return {id:orderId,accountId:accountId,saleAccountId:saleAccountId,productId:p.productId,date:p.date,customerName:customer,type:p.type,isCare:p.isCare===true,isSplit:p.isSplit===true,isBounced:p.isBounced===true,amountUsd:usd,rate:rate,amountVnd:num_(Math.round(usd*rate),false),revision:(old?old.revision||0:0)+1,createdAt:old?old.createdAt||null:now_(),createdById:old?old.createdById||null:user.id,createdByName:old?old.createdByName||null:user.ownerName,createdByRole:old?old.createdByRole||null:user.role,updatedAt:now_(),updatedById:user.id,updatedByName:user.ownerName};
}
function prepareProduct_(p,user){
    admin_(user);var name=String(p.name||'').trim();if(!name||name.length>100)throw applicationError_('Tên sản phẩm chưa hợp lệ.');var price=num_(p.priceUsd,false),rate=num_(p.rate,false);if(price<=0||rate<=0)throw applicationError_('Giá và tỷ giá phải lớn hơn 0.');
    var productId=p.id||newId_(),old=get_('Products',productId),active=p.active!==false,color=/^#[0-9a-fA-F]{6}$/.test(p.color)?p.color:'#18765c';
    if(read_('Products').some(function(x){return x.name.toLowerCase()===name.toLowerCase()&&x.id!==productId;}))throw applicationError_('Tên sản phẩm đã tồn tại.');
    if(p.id&&!old)throw applicationError_('Không tìm thấy sản phẩm.');if(p.id&&old&&Number(p.revision||0)!==Number(old.revision||0))throw conflict_();
    if(!p.id&&old){if(old.name!==name||old.priceUsd!==price||old.rate!==rate||old.active!==active||old.color!==color)throw conflict_();return old;}
    return {id:productId,revision:(old?old.revision||0:0)+1,name:name,priceUsd:price,rate:rate,active:active,color:color,updatedAt:now_()};
}

// Validate the entire employee selection before any staged product/assignment writes.
function prepareProductAssignments_(payload,productId){
 if(payload.accountIds===undefined)return [];
 if(!Array.isArray(payload.accountIds)||payload.accountIds.length>500)throw applicationError_('Danh sách nhân viên không hợp lệ.');
 var seen=Object.create(null),existing=read_('Assignments');
 return payload.accountIds.map(function(id){
  if(typeof id!=='string'||seen[id])throw applicationError_('Nhân viên bị trùng hoặc ID không hợp lệ.');seen[id]=true;
  var a=get_('Accounts',id);if(!a||!employeeRole_(a.role)||!a.active||a.deletedAt)throw applicationError_('Nhân viên đã bị xóa, khóa hoặc không phải user. Tải lại danh sách nhân viên.');
  var candidateId=newId_(),old=existing.find(function(x){return x.accountId===id&&x.productId===productId;});
  return {id:old?old.id:candidateId,accountId:id,productId:productId,active:true,updatedAt:now_()};
 });
}

var BUSINESS_TABLES_=['Accounts','Products','Assignments','Reports','Orders','Appointments','Targets','ReportRequests','TargetRequests'];
function rememberBefore_(table,id,value){
 if(!REQUEST_||!BUSINESS_TABLES_.includes(table))return;
 var records=REQUEST_.before[table]||(REQUEST_.before[table]=Object.create(null));
 if(!Object.prototype.hasOwnProperty.call(records,id))records[id]=value;
}
function notifyChanges_(actor,action,p){
 var accountRows=read_('Accounts'),knownNotifications=new Set(read_('Notifications').map(function(n){return n.id;}));
 var admins=accountRows.filter(function(a){return a.active&&a.role==='admin';}).map(function(a){return a.id;});
 BUSINESS_TABLES_.forEach(function(table){
  var changed=(REQUEST_.changes[table]||[]).concat(REQUEST_.removed[table]||[]);
  Array.from(new Set(changed)).forEach(function(id){
   var before=REQUEST_.before[table]?.[id]||null,after=get_(table,id),record=after||before;if(!record)return;
   var recipients=admins.slice(),target={page:'overview'},label='';
   [before,after].filter(Boolean).forEach(function(r){if(table==='Accounts')recipients.push(r.id);else if(table==='Orders'||table==='Appointments')recipients.push(r.accountId,r.saleAccountId);else if(r.accountId)recipients.push(r.accountId);});
   if(table==='Appointments'){label='đơn hẹn của '+record.customerName;target={page:'appointments',focus:id,date:record.date};}
   if(table==='Orders'){label='đơn hàng '+record.customerName;target={page:'orders',focus:id,date:record.date};}
   if(table==='ReportRequests'){label='yêu cầu '+(record.kind==='fill'?'điền':'sửa')+' báo cáo ngày '+record.date+(record.reason?' — '+record.reason:'');target={page:'daily',report:{accountId:record.accountId,date:record.date}};}
   if(table==='TargetRequests'){label='yêu cầu gửi mục tiêu tháng '+record.month+(record.reason?' — '+record.reason:'');target={page:'targets',accountId:record.accountId,month:record.month};}
   if(table==='Reports'){label='báo cáo ngày '+record.date;target={page:'daily',report:{id:id,accountId:record.accountId,date:record.date}};}
   if(table==='Targets'){label='mục tiêu tháng '+record.month;target={page:'targets',focus:id,accountId:record.accountId,month:record.month};}
   if(table==='Accounts'){label='tài khoản '+record.ownerName;target={page:actor.role==='admin'?'accounts':'overview',focus:id};}
   if(table==='Products'){label='sản phẩm '+record.name;target={page:'products',focus:id};read_('Assignments').filter(function(a){return a.productId===id&&a.active;}).forEach(function(a){recipients.push(a.accountId);});}
   if(table==='Assignments'){label='phân phối sản phẩm '+(get_('Products',record.productId)?.name||'');target={page:'accounts',focus:record.accountId};}
   var verb=action==='deleteAccount'?'xóa':action==='restoreAccount'?'khôi phục':!after?'xóa':table==='Orders'&&(action==='saveOrdersBulk'||action==='saveOrder'&&!p.id)?'thêm':!before?'thêm':'cập nhật';
   Array.from(new Set(recipients.filter(Boolean))).forEach(function(recipientId){
    var person=accountRows.find(function(a){return a.id===recipientId;});if(recipientId===actor.id||!person||!person.active)return;
    // Non-admins open their own permitted view, never a management screen.
    var dest=JSON.parse(JSON.stringify(target));if(person.role!=='admin'&&['products','accounts'].includes(dest.page))dest={page:'overview',team:person.role==='sale'?'sale':undefined};
    if(table==='Accounts'&&person.role!=='admin')dest={page:'overview'};
    var notificationId='nt_'+sha_((REQUEST_.idSeed||action+'|'+now_())+'|'+table+'|'+id+'|'+recipientId).replace(/=+$/,'');
    if(knownNotifications.has(notificationId))return;knownNotifications.add(notificationId);
    put_('Notifications',{id:notificationId,recipientId:recipientId,actorId:actor.id,actorName:actor.ownerName,actorRole:actor.role,action:action,entityType:table,entityId:id,title:(actor.role==='admin'?'Admin':actor.role==='sale'?'SALE':'MKT')+' - '+actor.ownerName+' đã '+verb+' '+label,target:dest,deleted:!after||action==='deleteAccount',createdAt:now_(),readAt:null,announcedAt:null});
   });
  });
 });
}
function notificationFeed_(user,offset){
 offset=Number(offset||0);if(!Number.isInteger(offset)||offset<0||offset>1000000)throw applicationError_('Trang thông báo không hợp lệ.');
 var rows=read_('Notifications').filter(function(n){return n.recipientId===user.id;}).sort(function(a,b){return b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id);});
 return {items:rows.slice(offset,offset+100),nextOffset:offset+100<rows.length?offset+100:null,unreadCount:rows.filter(function(n){return !n.readAt;}).length};
}
function ackNotifications_(user,p){
 if(!Array.isArray(p.ids)||!p.ids.length||p.ids.length>100||!(p.read===true||p.announced===true))throw applicationError_('Yêu cầu thông báo không hợp lệ.');
 var rows=Array.from(new Set(p.ids)).map(function(id){var n=get_('Notifications',id);if(!n||n.recipientId!==user.id)throw applicationError_('Không có quyền truy cập thông báo này.');return n;});
 rows.forEach(function(n){if(p.read===true&&!n.readAt)n.readAt=now_();if(p.announced===true&&!n.announcedAt)n.announcedAt=now_();put_('Notifications',n);});
}

 function validateTransfers_(p,old,accountId,user,entries){
  const transfers=p.transfers===undefined?(old?.transfers||[]):p.transfers;
  if(!Array.isArray(transfers)||transfers.length>100)throw applicationError_('Tối đa 100 khoản chuyển.');
  if(get_('Accounts',accountId).role==='sale'&&transfers.length)throw applicationError_('SALE không có ngân sách quảng cáo.');
  for(const t of transfers){
   if(!t||typeof t.fromProductId!=='string'||typeof t.toProductId!=='string'||!Number.isSafeInteger(t.amount)||t.amount<=0)throw applicationError_('Khoản chuyển không hợp lệ.');
   if(user.role!=='admin')for(const id of [t.fromProductId,t.toProductId])checkProduct_(accountId,id);
   if(!entries.some(e=>e.productId===t.fromProductId)||!entries.some(e=>e.productId===t.toProductId))throw applicationError_('Báo cáo cần có cả sản phẩm nguồn và sản phẩm nhận.');
  }
  return transfers.map(t=>({fromProductId:t.fromProductId,toProductId:t.toProductId,amount:t.amount}));
 }
 function completeRequests_(accountId,date,user){
  read_('ReportRequests').filter(r=>r.accountId===accountId&&r.date===date&&r.status==='pending').forEach(r=>{r.status='completed';r.completedAt=now_();r.completedBy=user.id;r.revision++;put_('ReportRequests',r);});
 }

 function saveAppointment_(p,user){
  date_(p.date);const old=p.id?get_('Appointments',p.id):null;
  if(p.id&&!old)throw applicationError_('Đơn hẹn không còn tồn tại.');
  if(user.role==='admin'&&!old)throw applicationError_('Admin chỉ sửa đơn hẹn đã có.');
  if(old&&user.role!=='admin'&&old.accountId!==user.id&&old.saleAccountId!==user.id)throw applicationError_('Không có quyền sửa đơn hẹn này.');
  if(old&&Number(p.revision||0)!==Number(old.revision||0))throw conflict_();
  if(!['pending','converted','cancelled'].includes(p.status)||typeof p.customerName!=='string'||!p.customerName.trim()||p.customerName.trim().length>160||typeof (p.note||'')!=='string'||String(p.note||'').length>500)throw applicationError_('Thông tin đơn hẹn chưa hợp lệ.');
  const accountId=user.role==='sale'?String(p.accountId||''):owner_(p.accountId,user),account=get_('Accounts',accountId);
  if(!account||account.role!=='user'||(!account.active&&(!old||old.accountId!==accountId||old.productId!==p.productId)))throw applicationError_('Chọn MKT đang hoạt động.');
  if(!(old&&old.accountId===accountId&&old.productId===p.productId))checkProduct_(accountId,p.productId);
  let saleAccountId=user.role==='sale'?user.id:(Object.prototype.hasOwnProperty.call(p,'saleAccountId')?p.saleAccountId||null:old?.saleAccountId||null);
  if(saleAccountId&&(!old||old.saleAccountId!==saleAccountId||old.productId!==p.productId)){const sale=get_('Accounts',saleAccountId);if(!sale||sale.role!=='sale'||!sale.active)throw applicationError_('SALE phụ trách không hợp lệ.');checkProduct_(saleAccountId,p.productId);}
  if(user.role==='sale'&&!(old&&old.saleAccountId===user.id&&old.productId===p.productId))checkProduct_(user.id,p.productId);
  const next={id:old?.id||newId_(),accountId,saleAccountId,productId:p.productId,date:p.date,customerName:p.customerName.trim(),note:String(p.note||'').trim(),status:p.status,revision:(old?.revision||0)+1,createdAt:old?.createdAt||now_(),createdBy:old?.createdBy||user.id,updatedAt:now_()};
  put_('Appointments',next);
  const related=[old,next].filter(Boolean);read_('Reports').filter(r=>related.some(a=>a.date===r.date&&(a.accountId===r.accountId||a.saleAccountId===r.accountId))).forEach(report=>{
   const before=structuredClone(report),role=get_('Accounts',report.accountId)?.role;
   report.entries=report.entries.map(entry=>related.some(a=>a.date===report.date&&a.productId===entry.productId&&(a.accountId===report.accountId||a.saleAccountId===report.accountId))?{...entry,appointments:appointmentCount(read_('Appointments'),report.accountId,report.date,entry.productId,role,0)}:entry);
   if(JSON.stringify(before.entries)!==JSON.stringify(report.entries)){report.revision=(report.revision||0)+1;report.updatedAt=now_();put_('Reports',report);audit_(user.id,'appointmentsRecomputed',{reportId:report.id,accountId:report.accountId,before,after:report});}
  });
  return true;
 }
 function extraMutation_(action,p,user){
  if(action==='saveAppointment')return saveAppointment_(p,user);
  if(action==='deleteReport'){
   admin_(user);const r=get_('Reports',p.id);if(!r)throw applicationError_('Không tìm thấy báo cáo.');if(r.revision!==Number(p.revision))throw conflict_();
   const next=normalizeReportBudgets_(read_('Reports').filter(x=>x.id!==r.id));
   remove_('Reports',r.id);writeReportBudgets_(next,null,user);audit_(user.id,'reportDeleted',{reportId:r.id,accountId:r.accountId,before:r});return true;
  }
  if(action==='requestReport'){
   admin_(user);const dates=Array.isArray(p.dates)?[...new Set(p.dates)]:[p.date];const a=get_('Accounts',p.accountId);
   if(!a||!a.active||!employeeRole_(a.role)||!['fill','correct'].includes(p.kind)||typeof p.reason!=='string'||p.reason.length>1000||dates.length<1||dates.length>366||dates.some(d=>typeof d!=='string'))throw applicationError_('Yêu cầu báo cáo không hợp lệ.');
   dates.forEach(date_);dates.forEach(function(date){
    const old=read_('ReportRequests').find(r=>r.accountId===a.id&&r.date===date&&r.status==='pending');
    put_('ReportRequests',{id:old?.id||newId_(),accountId:a.id,date:date,kind:p.kind,reason:p.reason,status:'pending',requestedBy:user.id,createdAt:old?.createdAt||now_(),updatedAt:now_(),revision:(old?.revision||0)+1});
   });return true;
  }
  if(action==='cancelReportRequest'){
   admin_(user);const r=get_('ReportRequests',p.id);if(!r)throw applicationError_('Không tìm thấy yêu cầu.');if(r.revision!==Number(p.revision))throw conflict_();r.status='cancelled';r.revision++;r.updatedAt=now_();put_('ReportRequests',r);return true;
  }
  if(action==='requestTarget'){
   admin_(user);const a=get_('Accounts',p.accountId);
   if(!a||!a.active||!employeeRole_(a.role)||!/^\d{4}-(0[1-9]|1[0-2])$/.test(p.month)||typeof p.reason!=='string'||p.reason.length>1000)throw applicationError_('Yêu cầu gửi mục tiêu không hợp lệ.');
   const old=read_('TargetRequests').find(r=>r.accountId===a.id&&r.month===p.month&&r.status==='pending');
   put_('TargetRequests',{id:old?.id||newId_(),accountId:a.id,month:p.month,reason:p.reason,status:'pending',requestedBy:user.id,createdAt:old?.createdAt||now_(),updatedAt:now_(),revision:(old?.revision||0)+1});return true;
  }
  if(action==='cancelTargetRequest'){
   admin_(user);const r=get_('TargetRequests',p.id);if(!r)throw applicationError_('Không tìm thấy yêu cầu.');if(r.revision!==Number(p.revision))throw conflict_();r.status='cancelled';r.revision++;r.updatedAt=now_();put_('TargetRequests',r);return true;
  }
  return false;
 }
 function execute(req){
  if(!req||typeof req!=='object'||Array.isArray(req)||!req.payload||typeof req.payload!=='object'||Array.isArray(req.payload))throw applicationError_('Yêu cầu không hợp lệ.');
  const action=req.action,p=req.payload;
  if(action==='login'){
   const username=String(p.username||'').trim().toLowerCase(),password=String(p.password||'');
   if(username.length>60||password.length<6||password.length>20)throw applicationError_('Thông tin đăng nhập không hợp lệ.');
   const a=read_('Accounts').find(x=>x.username.toLowerCase()===username&&x.active&&!x.deletedAt);
   // Equal-cost dummy derivation avoids a cheap username-existence signal.
   const candidate=a||{salt:'missing-account-salt',iterations:210000};
   const digest=passwordDigest_(password,candidate);
   if(!a||!equal_(digest,a.passwordHash))throw applicationError_('Tên đăng nhập hoặc mật khẩu không đúng.');
   if(!a.pepperVersion||a.iterations<210000){Object.assign(a,passwordRecord_(password));put_('Accounts',a);}
   const token=uuid_()+uuid_();const sessionDuration=sessionMaxAge(p.rememberMe)*1000;put_('Sessions',{id:sha_(token),accountId:a.id,expires:Date.now()+sessionDuration});
   return {user:publicAccount_(a),token,db:visible_(a,scope_({}))};
  }
  const user=requestUser_(req);
  if(action==='bootstrap')return visible_(user,scope_(p));
  if(action==='notifications')return notificationFeed_(user,p.offset);
  if(action==='ackNotifications'){ackNotifications_(user,p);return notificationFeed_(user,0);}
  if(action==='reportHistory'){
   const report=get_('Reports',p.id);if(!report)throw applicationError_('Không tìm thấy báo cáo.');if(user.role!=='admin'&&report.accountId!==user.id)throw Object.assign(new Error('Không có quyền xem lịch sử báo cáo này.'),{code:'FORBIDDEN'});const offset=Number(p.offset||0);
   if(!Number.isInteger(offset)||offset<0||offset>1000000)throw applicationError_('Trang không hợp lệ.');
   const logs=read_('Audit').filter(a=>a.details?.reportId===p.id).sort((a,b)=>b.time.localeCompare(a.time)||b.id.localeCompare(a.id));
   return {audit:logs.slice(offset,offset+100),nextOffset:offset+100<logs.length?offset+100:null};
  }
  if(action==='logout'){remove_('Sessions',sha_(req.token));return true;}
  if(!/^[a-zA-Z0-9_-]{16,100}$/.test(req.requestId||''))throw applicationError_('Thiếu mã chống lưu trùng.');
  const fingerprint=sha_(JSON.stringify({action,payload:p}));
  const receipt=read_('Audit').find(a=>a.actorId===user.id&&a.action==='requestCompleted'&&a.details.requestId===req.requestId);
  if(receipt){if(receipt.details.fingerprint!==fingerprint)throw applicationError_('Mã yêu cầu đã dùng với dữ liệu khác.');return delta_(user,receipt.details.changes,receipt.details.removed);}
  if(['saveOrder','deleteOrder'].includes(action)&&p.id){const old=get_('Orders',p.id);if(old&&Number(p.revision)!==Number(old.revision||0))throw conflict_();}
  REQUEST_.idSeed=user.id+'|'+req.requestId+'|'+action;REQUEST_.idCounter=0;
  mutate_(action,p,user,sha_(req.token));notifyChanges_(user,action,p);audit_(user.id,action,{id:p.id||null,date:p.date||null,accountId:p.accountId||null});
  const changes=structuredClone(REQUEST_.changes),removed=structuredClone(REQUEST_.removed);
  audit_(user.id,'requestCompleted',{requestId:req.requestId,fingerprint,changes,removed});
  return delta_(get_('Accounts',user.id),changes,removed);
 }
 return {execute,rows:read_,changes:()=>REQUEST_,window:scope_};
}
