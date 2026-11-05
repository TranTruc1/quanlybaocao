/** SỔ LIỆU — Google Apps Script backend.
 * Gắn script vào Google Sheet của bạn. Chạy setup(), rồi createInitialAdmin().
 * Không đặt mật khẩu trong frontend/config.js. Xem README.md.
 */
var TABLES_ = ['Accounts','Products','Assignments','Reports','Orders','Targets','Sessions','Audit'];
var FIELDS_ = ['budget','remaining','data','tt','ktt','success','upsale','appointments','late'];
var PBKDF_ITERATIONS_ = 20000;

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw applicationError_('Mở Apps Script từ Google Sheet rồi chạy setup().');
  PropertiesService.getScriptProperties().setProperty('SL_SPREADSHEET_ID', ss.getId());
  TABLES_.forEach(function(name){
    var s=ss.getSheetByName('SL_'+name);
    if(!s){s=ss.insertSheet('SL_'+name);s.appendRow(['id','json']);s.setFrozenRows(1);s.getRange(1,1,1,2).setBackground('#17644e').setFontColor('#ffffff').setFontWeight('bold');s.setColumnWidth(1,260);s.setColumnWidth(2,900);}
  });
  SpreadsheetApp.getUi().alert('Đã tạo các bảng SL_*. Các sheet hiện có được giữ nguyên. Chạy createInitialAdmin() để tạo admin.');
}

function createInitialAdmin() {
  var ui=SpreadsheetApp.getUi();
  if(read_('Accounts').some(function(a){return a.role==='admin';})) throw applicationError_('Đã có admin. Không thể khởi tạo lại.');
  var n=ui.prompt('Tên chủ sở hữu', 'Nhập tên admin', ui.ButtonSet.OK_CANCEL);if(n.getSelectedButton()!==ui.Button.OK)return;
  var u=ui.prompt('Tên đăng nhập admin', 'Chữ, số, dấu . _ -', ui.ButtonSet.OK_CANCEL);if(u.getSelectedButton()!==ui.Button.OK)return;
  var p=ui.prompt('Mật khẩu admin', 'Từ 6 đến 20 ký tự; không ghi mật khẩu vào mã nguồn.', ui.ButtonSet.OK_CANCEL);if(p.getSelectedButton()!==ui.Button.OK)return;
  var username=u.getResponseText().trim(),owner=n.getResponseText().trim(),password=p.getResponseText();
  checkAccount_({username:username,ownerName:owner,password:password},true);
  var lock=LockService.getScriptLock();lock.waitLock(30000);
  try {if(read_('Accounts').length)throw applicationError_('Account đã được khởi tạo.');put_('Accounts',Object.assign({id:uuid_(),username:username,ownerName:owner,role:'admin',active:true},passwordRecord_(password)));}
  finally{lock.releaseLock();}
  ui.alert('Đã tạo admin. Triển khai Web App và đăng nhập bằng account vừa tạo.');
}

function doGet(){return json_({ok:true,data:{name:'Sổ Liệu API',version:'1.0.0'}});}
function doPost(e){
  beginRequest_();
  try {
    if(!e||!e.postData||typeof e.postData.contents!=='string'||e.postData.contents.length>300000)throw applicationError_('Yêu cầu không hợp lệ.');
    var req=JSON.parse(e.postData.contents);if(!req||typeof req!=='object'||Array.isArray(req))throw applicationError_('Yêu cầu không hợp lệ.');
    var action=req.action,p=req.payload||{},v2=req.protocol===2;
    if(!p||typeof p!=='object'||Array.isArray(p))throw applicationError_('Dữ liệu không hợp lệ.');
    if(action==='login')return json_({ok:true,data:login_(p,v2)});
    if(['bootstrap','reportHistory'].includes(action)){
      var readLock=LockService.getScriptLock();readLock.waitLock(30000);
      try{beginRequest_();var reader=requestUser_(req);
      if(action==='bootstrap')return json_({ok:true,data:visible_(reader,v2?scope_(p):null)});
      if(action==='reportHistory'){admin_(reader);var report=get_('Reports',p.id);if(!report)throw applicationError_('Không tìm thấy bảng.');var offset=Number(p.offset||0);if(!Number.isInteger(offset)||offset<0||offset>1000000)throw applicationError_('Trang lịch sử không hợp lệ.');var logs=read_('Audit').filter(function(a){return a.details&&a.details.reportId===p.id;}).sort(function(a,b){return b.time.localeCompare(a.time)||b.id.localeCompare(a.id);});return json_({ok:true,data:{audit:logs.slice(offset,offset+100),nextOffset:offset+100<logs.length?offset+100:null}});}
      }finally{readLock.releaseLock();}
    }
    var lock=LockService.getScriptLock();lock.waitLock(30000);
    try {
      beginRequest_();var user=requestUser_(req);
      if(action==='logout'){remove_('Sessions',sha_(req.token));flushRequest_();return json_({ok:true,data:true});}
      if(v2&&(!/^[a-zA-Z0-9_-]{16,100}$/.test(req.requestId||'')))throw applicationError_('Thiếu mã chống lưu trùng.');
      var fingerprint=sha_(JSON.stringify({action:action,payload:p}));
      var receipt=v2?read_('Audit').find(function(a){return a.actorId===user.id&&a.action==='requestCompleted'&&a.details.requestId===req.requestId;}):null;
      if(receipt){if(receipt.details.fingerprint!==fingerprint)throw applicationError_('Mã yêu cầu đã dùng với dữ liệu khác.');return json_({ok:true,data:delta_(user,receipt.details.changes,receipt.details.removed)});}
      if(v2&&['saveOrder','deleteOrder'].includes(action)&&p.id){var existing=get_('Orders',p.id);if(existing&&Number(p.revision)!==Number(existing.revision||0))throw conflict_();}
      if(v2){REQUEST_.idSeed=user.id+'|'+req.requestId+'|'+action;REQUEST_.idCounter=0;}
      mutate_(action,p,user);audit_(user.id,action,{id:p.id||null,date:p.date||null,accountId:p.accountId||null});
      var changes=JSON.parse(JSON.stringify(REQUEST_.changes)),removed=JSON.parse(JSON.stringify(REQUEST_.removed));
      var data=v2?delta_(get_('Accounts',user.id),changes,removed):visible_(get_('Accounts',user.id));
      if(v2)audit_(user.id,'requestCompleted',{requestId:req.requestId,fingerprint:fingerprint,changes:changes,removed:removed});
      flushRequest_();return json_({ok:true,data:data});
    }finally{lock.releaseLock();}
  }catch(err){var code=err.code||(err instanceof SyntaxError?'VALIDATION_ERROR':'SERVER_ERROR'),message=code==='SERVER_ERROR'?'Máy chủ chưa hoàn tất yêu cầu. Thử lại cùng dữ liệu; nếu vẫn lỗi hãy liên hệ admin.':String(err.message||'Yêu cầu không hợp lệ.');return json_({ok:false,error:message,code:code});}
  finally{REQUEST_=null;}
}

function mutate_(action,p,user){
  if(action==='saveReport') {
    date_(p.date);var accountId=owner_(p.accountId,user);var account=get_('Accounts',accountId);if(!account||!account.active)throw Object.assign(new Error('Account không hoạt động.'),{code:'UNAUTHENTICATED'});
    if(!['draft','submitted'].includes(p.status)||!Array.isArray(p.entries)||p.entries.length<1||p.entries.length>100)throw applicationError_('Bảng nhập không hợp lệ.');
    var old=read_('Reports').find(function(r){return r.accountId===accountId&&r.date===p.date;});
    if(user.role==='admin'&&!old)throw applicationError_('Admin chỉ xem và sửa báo cáo đã có.');
    checkReportSequence_(accountId,p.date,user);
    
    if(old&&old.status==='submitted'&&p.status==='draft')p.status='submitted';
    if(old&&old.revision!==Number(p.revision))throw applicationError_('Bảng đã được cập nhật. Tải lại trước khi sửa.');
    var ids=Object.create(null);var entries=p.entries.map(function(e){
      if(ids[e.productId])throw applicationError_('Sản phẩm bị trùng trong bảng.');ids[e.productId]=true;
      var previousEntry=old&&old.entries.find(function(x){return x.productId===e.productId;});var unchanged=previousEntry&&old.status==='submitted'&&Object.prototype.hasOwnProperty.call(e,'received')===Object.prototype.hasOwnProperty.call(previousEntry,'received')&&['received','budget','remaining','data','tt','ktt','appointments','late'].every(function(k){return Number(e[k]||0)===Number(previousEntry[k]||0);});if(!(previousEntry&&user.role==='admin')&&!unchanged)checkProduct_(accountId,e.productId);var clean={productId:e.productId};
      FIELDS_.forEach(function(k){clean[k]=num_(e[k],!['budget','remaining','success','upsale'].includes(k));});
      ['success','upsale'].forEach(function(k){if(!Number.isInteger(clean[k]*2))throw applicationError_('So don phai theo buoc 0,5.');});
      var matchingOrders=read_('Orders').filter(function(o){return o.accountId===accountId&&o.productId===e.productId&&o.date===p.date&&!o.isBounced;});
      clean.success=matchingOrders.filter(function(o){return !careOrder_(o);}).reduce(function(n,o){return n+weightOrder_(o);},0);
      clean.upsale=matchingOrders.filter(function(o){return o.type==='upsale';}).reduce(function(n,o){return n+weightOrder_(o);},0);
      if(Object.prototype.hasOwnProperty.call(e,'received')){clean.received=num_(e.received,false);}else if(clean.remaining>clean.budget)throw applicationError_('Thừa cuối ngày không thể vượt ngân sách.');return clean;
    });
    if(user.role!=='admin'&&old&&old.entries.some(function(e){return !ids[e.productId];}))throw applicationError_('Không được bỏ sản phẩm đã có trong báo cáo. Không phát sinh vẫn giữ dòng số 0.');
    if(user.role!=='admin'&&p.status==='submitted'&&(!old||(old.status==='draft'&&!old.postedEntries))){var required=read_('Assignments').filter(function(a){return a.accountId===accountId&&a.active&&get_('Products',a.productId)?.active;});if(required.some(function(a){return !ids[a.productId];}))throw applicationError_('Cần điền đủ sản phẩm được giao. Không phát sinh vẫn gửi số 0.');}
    var proposed={id:old?old.id:newId_(),accountId:accountId,date:p.date,status:p.status,entries:entries,revision:(old?old.revision:0)+1,updatedAt:now_(),submittedAt:p.status==='submitted'?(old&&old.submittedAt?old.submittedAt:now_()):(old?old.submittedAt:null),postedEntries:p.status==='draft'&&old?old.postedEntries:null};
    writeReportBudgets_(read_('Reports').filter(function(r){return r.id!==proposed.id;}).concat([proposed]),proposed.id,user);
  } else if(action==='changeReportDate') {
    var report=get_('Reports',p.id);if(!report||(user.role!=='admin'&&report.accountId!==user.id))throw applicationError_('Không có quyền sửa bảng này.');
    date_(p.date);if(report.revision!==Number(p.revision))throw applicationError_('Bảng vừa được cập nhật. Tải lại trước khi sửa.');
    if(read_('Reports').some(function(r){return r.id!==report.id&&r.accountId===report.accountId&&r.date===p.date;}))throw applicationError_('Account đã có bảng ở ngày này. Chọn ngày khác hoặc chỉnh bảng hiện có.');
    checkReportSequence_(report.accountId,p.date,user,report.id);
    var previousDate=report.date;report.date=p.date;report.revision++;report.updatedAt=now_();writeReportBudgets_(read_('Reports').filter(function(r){return r.id!==report.id;}).concat([report]),report.id,user);audit_(user.id,'reportDateChanged',{id:report.id,from:previousDate,to:p.date});
  } else if(action==='reopen') {
    admin_(user);var r=get_('Reports',p.id);if(!r)throw applicationError_('Không tìm thấy bảng.');var beforeReopen=JSON.parse(JSON.stringify(r));r.postedEntries=JSON.parse(JSON.stringify(r.entries));r.status='draft';r.revision++;r.updatedAt=now_();put_('Reports',r);audit_(user.id,'reportReopened',{reportId:r.id,accountId:r.accountId,before:beforeReopen,after:r});
  } else if(action==='saveOrder') {
    put_('Orders',prepareOrder_(p,user));
  } else if(action==='saveOrdersBulk'||action==='saveProductsBulk') {
    var productBatch=action==='saveProductsBulk';if(productBatch)admin_(user);else if(user.role==='admin')throw applicationError_('Admin chỉ sửa đơn đã có.');
    if(!Array.isArray(p.rows)||p.rows.length<1||p.rows.length>50||typeof p.batchId!=='string'||!/^[a-zA-Z0-9_-]{8,100}$/.test(p.batchId))throw applicationError_('Lô không hợp lệ; tối đa 50 dòng.');
    var fingerprint=sha_(JSON.stringify(p.rows));var saved=read_('Audit').find(function(a){return a.actorId===user.id&&a.action==='batchSaved'&&a.details.batchId===p.batchId;});
    if(saved){if(saved.details.fingerprint!==fingerprint)throw applicationError_('Lô này đã lưu với nội dung khác. Tải lại danh sách trước khi tạo lô mới.');return;}
    var assignmentPlans=[],seenNames=Object.create(null);var records=p.rows.map(function(row,index){
      try{if(row.id)throw applicationError_('Lô chỉ dùng thêm mới.');var record=productBatch?prepareProduct_(row,user):prepareOrder_(row,user);if(productBatch){assignmentPlans=assignmentPlans.concat(prepareProductAssignments_(row,record.id));var name=record.name.toLowerCase();if(seenNames[name])throw applicationError_('Tên sản phẩm trùng trong lô.');seenNames[name]=true;}return record;}
      catch(e){throw Object.assign(new Error('Dòng '+(index+1)+': '+e.message),{code:e.code});}
    });
    records.forEach(function(r){put_(productBatch?'Products':'Orders',r);});assignmentPlans.forEach(function(a){put_('Assignments',a);});
    audit_(user.id,'batchSaved',{batchId:p.batchId,fingerprint:fingerprint,count:records.length,table:productBatch?'Products':'Orders'});
  } else if(action==='deleteOrder') {
    var o=get_('Orders',p.id);if(!o)throw applicationError_('Không tìm thấy đơn.');if(user.role!=='admin'&&o.accountId!==user.id)throw applicationError_('Không có quyền xóa đơn.');remove_('Orders',p.id);
  } else if(action==='saveProduct') {
    var product=prepareProduct_(p,user),assignments=prepareProductAssignments_(p,product.id);put_('Products',product);assignments.forEach(function(a){put_('Assignments',a);});
  } else if(action==='saveAccount') {
    admin_(user);var old=p.id?get_('Accounts',p.id):null;if(p.id&&!old)throw applicationError_('Không tìm thấy account.');
    if(old&&old.deletedAt)throw applicationError_('Khôi phục account trước khi chỉnh sửa.');checkAccount_(p,!old);if(old&&Number(p.revision||0)!==Number(old.revision||0))throw conflict_();var username=String(p.username).trim();
    var nextRole=p.role===undefined?(old?old.role:'user'):p.role;
    if(['admin','user'].indexOf(nextRole)<0)throw applicationError_('Role phải là admin hoặc user.');
    if(old&&old.role==='admin'&&old.active&&nextRole!=='admin'&&read_('Accounts').filter(function(a){return a.role==='admin'&&a.active;}).length<=1)throw applicationError_('Không thể hạ quyền admin cuối cùng đang hoạt động.');
    if(read_('Accounts').some(function(a){return a.username.toLowerCase()===username.toLowerCase()&&a.id!==p.id;}))throw applicationError_('Tên đăng nhập đã tồn tại.');
    var record=Object.assign({},old||{id:newId_(),role:'user',active:true},{username:username,ownerName:p.ownerName.trim(),role:nextRole,revision:(old?old.revision||0:0)+1});
    if(p.password)Object.assign(record,passwordRecord_(p.password));put_('Accounts',record);
    if(old&&(p.password||old.role!==nextRole))read_('Sessions').filter(function(s){return s.accountId===old.id;}).forEach(function(s){remove_('Sessions',s.id);});
    if(old&&old.role!==nextRole)audit_(user.id,'roleChanged',{accountId:record.id,beforeRole:old.role,afterRole:nextRole});
  } else if(action==='deleteAccount'||action==='restoreAccount') {
    admin_(user);var target=get_('Accounts',p.id);if(!target||target.role!=='user'||target.id===user.id)throw applicationError_('Chỉ được xóa hoặc khôi phục tài khoản user.');
    if(action==='deleteAccount'){
      target.active=false;target.deletedAt=now_();put_('Accounts',target);
      read_('Sessions').filter(function(s){return s.accountId===target.id;}).forEach(function(s){remove_('Sessions',s.id);});
      read_('Assignments').filter(function(a){return a.accountId===target.id&&a.active;}).forEach(function(a){a.active=false;a.updatedAt=now_();put_('Assignments',a);});
    }else{target.active=true;target.deletedAt=null;put_('Accounts',target);}
    audit_(user.id,action,{accountId:target.id,username:target.username});
  } else if(action==='assign') {
    admin_(user);var account=get_('Accounts',p.accountId),product=get_('Products',p.productId);if(!account||!account.active||account.role!=='user'||!product||!product.active)throw applicationError_('Account hoặc sản phẩm không hợp lệ.');
    var old=read_('Assignments').find(function(a){return a.accountId===p.accountId&&a.productId===p.productId;});put_('Assignments',{id:old?old.id:newId_(),accountId:p.accountId,productId:p.productId,active:p.active===true,updatedAt:now_()});
  } else if(action==='saveTargets') {
    p.accountId=owner_(p.accountId,user);if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(p.month))throw applicationError_('Tháng mục tiêu chưa hợp lệ.');var salary=num_(p.salary,false);if(!Array.isArray(p.targets)||p.targets.length<1||p.targets.length>100)throw applicationError_('Mục tiêu chưa hợp lệ.');
    if(!get_('Accounts',p.accountId))throw applicationError_('Không tìm thấy account.');
    var existing=read_('Targets');var ids=Object.create(null);var records=p.targets.map(function(t){if(ids[t.productId])throw applicationError_('Sản phẩm mục tiêu bị trùng.');ids[t.productId]=true;var product=get_('Products',t.productId);if(!product)throw applicationError_('Không tìm thấy sản phẩm.');var old=existing.find(function(x){return x.accountId===p.accountId&&x.productId===t.productId&&x.month===p.month;});if(old&&Number(t.revision||0)!==Number(old.revision||0))throw conflict_();if(!old||user.role!=='admin')checkProduct_(p.accountId,t.productId);return {id:old?old.id:newId_(),revision:(old?old.revision||0:0)+1,accountId:p.accountId,productId:t.productId,month:p.month,revenue:num_(t.revenue,false),care:num_(t.care,false),salary:salary,priceUsd:old?old.priceUsd:product.priceUsd,rate:old?old.rate:product.rate,updatedAt:now_()};});
    records.forEach(function(t){put_('Targets',t);});
  } else throw applicationError_('Thao tác không được hỗ trợ.');
}

function visible_(user,scope){
  var db={apiVersion:2,viewer:publicAccount_(user),accounts:read_('Accounts').map(publicAccount_),products:read_('Products'),assignments:read_('Assignments'),reports:read_('Reports'),orders:read_('Orders'),targets:read_('Targets'),audit:scope?[]:(user.role==='admin'?read_('Audit'):[])};
  if(user.role!=='admin'){
    ['accounts','assignments','reports','orders','targets'].forEach(function(key){db[key]=db[key].filter(function(r){return key==='accounts'?r.id===user.id:r.accountId===user.id;});});
    var ids=Object.create(null);db.assignments.filter(function(a){return a.active;}).forEach(function(a){ids[a.productId]=true;});db.reports.forEach(function(r){r.entries.forEach(function(e){ids[e.productId]=true;});});db.orders.forEach(function(o){ids[o.productId]=true;});db.targets.forEach(function(t){ids[t.productId]=true;});db.products=db.products.filter(function(p){return ids[p.id];});
  }
  if(scope){
    var latest=Object.create(null);
    db.reports.filter(function(r){return r.date<scope.from&&(r.status==='submitted'||r.postedEntries);}).sort(function(a,b){return a.date.localeCompare(b.date);}).forEach(function(r){(r.status==='submitted'?r.entries:r.postedEntries).forEach(function(e){latest[r.accountId+'|'+e.productId]={r:r,e:e};});});
    var contexts=Object.create(null);Object.keys(latest).forEach(function(k){var x=latest[k];if(!contexts[x.r.id])contexts[x.r.id]={id:x.r.id,accountId:x.r.accountId,date:x.r.date,status:'submitted',revision:x.r.revision,_carryContext:true,_normalized:true,entries:[]};contexts[x.r.id].entries.push({productId:x.e.productId,remaining:Number(x.e.remaining||0),budget:Number(x.e.remaining||0)});});
    db.reports=db.reports.filter(function(r){return r.date>=scope.from&&r.date<=scope.to;}).map(function(r){r._normalized=true;return r;}).concat(Object.keys(contexts).map(function(k){return contexts[k];}));
    db.orders=db.orders.filter(function(o){return o.date>=scope.from&&o.date<=scope.to;});
    db.targets=db.targets.filter(function(t){return t.month>=scope.from.slice(0,7)&&t.month<=scope.to.slice(0,7);});db.scope=scope;
  }
  return db;
}
function scope_(p){
  var yesterday=new Date();yesterday.setTime(yesterday.getTime()-86400000);var day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(yesterday);
  var from=p.from||day.slice(0,7)+'-01',to=p.to||day.slice(0,7)+'-'+String(new Date(Number(day.slice(0,4)),Number(day.slice(5,7)),0).getDate()).padStart(2,'0');date_(from);date_(to);
  if(from>to||(new Date(to)-new Date(from))/86400000>366)throw applicationError_('Chọn khoảng ngày hợp lệ, tối đa 367 ngày mỗi lần.');return {from:from,to:to};
}
function delta_(user,changes,removed){
  var result={kind:'delta',apiVersion:2,viewer:publicAccount_(user),upsert:{},removed:{}};
  ['Accounts','Products','Assignments','Reports','Orders','Targets'].forEach(function(table){var ids=(changes||{})[table]||[],rows=ids.map(function(id){return get_(table,id);}).filter(Boolean);
    if(user.role!=='admin')rows=rows.filter(function(r){return table==='Accounts'?r.id===user.id:table==='Products'?read_('Assignments').some(function(a){return a.active&&a.accountId===user.id&&a.productId===r.id;}):r.accountId===user.id;});
    if(table==='Accounts')rows=rows.map(publicAccount_);if(table==='Reports')rows=rows.map(function(r){r._normalized=true;return r;});
    result.upsert[table.toLowerCase()]=rows;result.removed[table.toLowerCase()]=(removed||{})[table]||[];
  });return result;
}
function applicationError_(message){return Object.assign(new Error(message),{code:/quyền|Chỉ admin|chưa được phân phối|Chỉ được sửa mục tiêu/.test(message)?'FORBIDDEN':'VALIDATION_ERROR'});}
function conflict_(){return Object.assign(new Error('Dữ liệu vừa được người khác cập nhật. Tải lại trước khi sửa.'),{code:'CONFLICT'});}

function login_(p,v2){
  var username=String(p.username||'').trim().toLowerCase(),password=String(p.password||'');if(username.length>100||password.length<6||password.length>20)throw applicationError_('Thông tin đăng nhập không hợp lệ.');
  var cache=CacheService.getScriptCache(),key='login:'+sha_(username),attempts=Number(cache.get(key)||0);if(attempts>=6)throw applicationError_('Đăng nhập sai nhiều lần. Thử lại sau 15 phút.');
  cache.put(key,String(attempts+1),900);
  var a=read_('Accounts').find(function(x){return x.username.toLowerCase()===username&&x.active;});
  if(!a||!equal_(passwordDigest_(password,a),a.passwordHash))throw applicationError_('Tên đăng nhập hoặc mật khẩu không đúng.');
  cache.remove(key);var token=uuid_()+uuid_();var hash=sha_(token);
  var lock=LockService.getScriptLock();lock.waitLock(30000);try{delete REQUEST_.tables.Accounts;var current=get_('Accounts',a.id);if(!current||!current.active||current.passwordHash!==a.passwordHash)throw applicationError_('Tài khoản vừa thay đổi. Đăng nhập lại.');a=current;if(!a.pepperVersion){a.passwordHash=pepperHash_(a.passwordHash);a.pepperVersion=1;put_('Accounts',a);}read_('Sessions').filter(function(s){return s.expires<Date.now();}).forEach(function(s){remove_('Sessions',s.id);});put_('Sessions',{id:hash,accountId:a.id,expires:Date.now()+12*60*60*1000});flushRequest_();return {user:publicAccount_(a),token:token,db:visible_(a,v2?scope_({}):null)};}finally{lock.releaseLock();}
}
function requestUser_(req){var user=session_(req.token);if(req.uiRole==='admin'&&user.role!=='admin'){var err=new Error('Không đủ quyền để thực hiện.');err.code='FORBIDDEN';throw err;}return user;}
function session_(token){if(typeof token!=='string'||token.length>200)throw Object.assign(new Error('Vui lòng đăng nhập.'),{code:'UNAUTHENTICATED'});var s=get_('Sessions',sha_(token));if(!s||s.expires<Date.now())throw Object.assign(new Error('Phiên hết hạn. Đăng xuất và đăng nhập lại.'),{code:'UNAUTHENTICATED'});var a=get_('Accounts',s.accountId);if(!a||!a.active)throw Object.assign(new Error('Account không hoạt động.'),{code:'UNAUTHENTICATED'});return a;}
function publicAccount_(a){return {id:a.id,username:a.username,ownerName:a.ownerName,role:a.role,active:a.active,deletedAt:a.deletedAt||null,revision:a.revision||0};}
function owner_(requested,user){if(user.role==='admin'){if(!requested)throw applicationError_('Chọn account.');return requested;}if(requested&&requested!==user.id)throw applicationError_('Không có quyền truy cập account khác.');return user.id;}
function admin_(u){if(u.role!=='admin')throw applicationError_('Chỉ admin có quyền thực hiện.');}
function checkProduct_(accountId,productId){var p=get_('Products',productId);if(!p||!p.active||!read_('Assignments').some(function(a){return a.accountId===accountId&&a.productId===productId&&a.active;}))throw applicationError_('Sản phẩm chưa được phân phối cho account hoặc đã ngừng dùng.');}
function checkAccount_(p,needsPassword){if(String(p.password||'').length>20)throw applicationError_('Mật khẩu tối đa 20 ký tự.');if(!String(p.ownerName||'').trim()||String(p.ownerName).length>100||! /^[a-zA-Z0-9_.-]{2,60}$/.test(String(p.username||'').trim()))throw applicationError_('Kiểm tra tên chủ sở hữu và tên đăng nhập (2–60 ký tự).');if((needsPassword||p.password)&&String(p.password||'').length<6)throw applicationError_('Mật khẩu cần ít nhất 6 ký tự.');}
function num_(v,int){var n=Number(v);if(!Number.isFinite(n)||n<0||n>1e13||(int&&!Number.isInteger(n)))throw applicationError_('Số liệu phải không âm; số đếm phải là số nguyên.');return n;}
function date_(v){if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||new Date(v+'T00:00:00Z').toISOString().slice(0,10)!==v)throw applicationError_('Ngày không hợp lệ.');}
function sheet_(name){if(TABLES_.indexOf(name)<0)throw applicationError_('Bảng không hợp lệ.');var id=PropertiesService.getScriptProperties().getProperty('SL_SPREADSHEET_ID');if(!id)throw applicationError_('Chạy setup() trong Apps Script trước.');var s=SpreadsheetApp.openById(id).getSheetByName('SL_'+name);if(!s)throw applicationError_('Thiếu bảng SL_'+name+'. Chạy setup().');return s;}
var REQUEST_=null;
function beginRequest_(){REQUEST_={tables:Object.create(null),dirty:Object.create(null),changes:Object.create(null),removed:Object.create(null)};}
function tableState_(name){
  if(!REQUEST_.tables[name]){var sheet=sheet_(name),last=sheet.getLastRow(),rows=last>1?sheet.getRange(2,1,last-1,2).getValues():[];REQUEST_.tables[name]={sheet:sheet,rows:rows};}return REQUEST_.tables[name];
}
function read_(name){
  var rows;if(REQUEST_)rows=tableState_(name).rows;else{var s=sheet_(name);rows=s.getLastRow()>1?s.getRange(2,1,s.getLastRow()-1,2).getValues():[];}
  return rows.filter(function(r){return r[0]&&r[1];}).map(function(r){return JSON.parse(r[1]);});
}
function get_(name,id){return read_(name).find(function(r){return r.id===id;})||null;}
function put_(name,record){
  if(!record||typeof record.id!=='string'||!record.id||record.id.length>100||(name!=='Sessions'&&/^[=+@\t\r-]/.test(record.id)))throw applicationError_('ID bản ghi không hợp lệ.');var serialized=JSON.stringify(record);if(serialized.length>48000)throw applicationError_('Bản ghi quá lớn; chia nhỏ bảng hoặc lô dữ liệu.');
  if(!REQUEST_){var s=sheet_(name),rows=s.getLastRow()>1?s.getRange(2,1,s.getLastRow()-1,1).getValues():[],i=rows.findIndex(function(r){return r[0]===record.id;});s.getRange(i<0?s.getLastRow()+1:i+2,1,1,2).setValues([[record.id,serialized]]);return;}
  var t=tableState_(name),i=t.rows.findIndex(function(r){return r[0]===record.id;});if(i<0){i=t.rows.findIndex(function(r){return !r[0];});if(i<0)i=t.rows.length;}
  t.rows[i]=[record.id,serialized];(REQUEST_.dirty[name]||(REQUEST_.dirty[name]=[])).push(i);var ids=REQUEST_.changes[name]||(REQUEST_.changes[name]=[]);if(ids.indexOf(record.id)<0)ids.push(record.id);
}
function remove_(name,id){
  if(!REQUEST_){var s=sheet_(name),rows=s.getLastRow()>1?s.getRange(2,1,s.getLastRow()-1,1).getValues():[],i=rows.findIndex(function(r){return r[0]===id;});if(i>=0)s.deleteRow(i+2);return;}
  var t=tableState_(name),i=t.rows.findIndex(function(r){return r[0]===id;});if(i<0)return;t.rows[i]=['',''];(REQUEST_.dirty[name]||(REQUEST_.dirty[name]=[])).push(i);(REQUEST_.removed[name]||(REQUEST_.removed[name]=[])).push(id);
}
function flushRequest_(){
  Object.keys(REQUEST_.dirty).forEach(function(name){var t=tableState_(name),indices=Array.from(new Set(REQUEST_.dirty[name])).sort(function(a,b){return a-b;});for(var n=0;n<indices.length;){var start=indices[n],end=start;while(n+1<indices.length&&indices[n+1]===end+1){n++;end++;}t.sheet.getRange(start+2,1,end-start+1,2).setValues(t.rows.slice(start,end+1));n++;}});REQUEST_.dirty=Object.create(null);
}

function audit_(actor,action,details){put_('Audit',{id:uuid_(),actorId:actor,action:action,details:details,time:now_()});}
function json_(x){return ContentService.createTextOutput(JSON.stringify(x)).setMimeType(ContentService.MimeType.JSON);}
function newId_(){return REQUEST_&&REQUEST_.idSeed?'sl_'+sha_(REQUEST_.idSeed+'|'+REQUEST_.idCounter++).replace(/=+$/,''):uuid_();}
function uuid_(){return Utilities.getUuid();}function now_(){return new Date().toISOString();}
function sha_(s){return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s,Utilities.Charset.UTF_8));}
function passwordRecord_(password){var salt=uuid_()+uuid_();return {salt:salt,iterations:PBKDF_ITERATIONS_,pepperVersion:1,passwordHash:pepperHash_(pbkdf_(password,salt,PBKDF_ITERATIONS_))};}
function pepperHash_(derived){var props=PropertiesService.getScriptProperties(),secret=props.getProperty('SL_AUTH_PEPPER');if(!secret){secret=uuid_()+uuid_()+uuid_();props.setProperty('SL_AUTH_PEPPER',secret);}return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(Utilities.newBlob(derived).getBytes(),Utilities.newBlob(secret).getBytes()));}
function passwordDigest_(password,account){var derived=pbkdf_(password,account.salt,account.iterations);return account.pepperVersion===1?pepperHash_(derived):derived;}
function pbkdf_(password,salt,iterations){
  var key=Utilities.newBlob(password).getBytes().map(function(b){return b&255;});
  var message=Utilities.newBlob(salt).getBytes().map(function(b){return b&255;}).concat([0,0,0,1]);
  if(key.length>64)key=fastSha256_(key);
  var inner=[],outer=[];
  for(var i=0;i<64;i++){inner[i]=(key[i]||0)^0x36;outer[i]=(key[i]||0)^0x5c;}
  function hmac(data){return fastSha256_(outer.concat(fastSha256_(inner.concat(data))));}
  var u=hmac(message),out=u.slice();
  for(var n=1;n<iterations;n++){u=hmac(u);for(var j=0;j<32;j++)out[j]^=u[j];}
  return Utilities.base64EncodeWebSafe(out.map(function(b){return b>127?b-256:b;}));
}
// Standard SHA-256 compression, in V8 to avoid 20,000 Apps Script service calls.
function fastSha256_(bytes){
  var k=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  var h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19],data=bytes.slice(),bits=data.length*8;
  data.push(128);while(data.length%64!==56)data.push(0);
  for(var i=7;i>=0;i--)data.push(i<4?(bits>>>i*8)&255:Math.floor(bits/Math.pow(2,i*8))&255);
  function ro(x,n){return (x>>>n)|(x<<(32-n));}
  for(var offset=0;offset<data.length;offset+=64){
    var w=new Array(64);
    for(var t=0;t<16;t++){var pos=offset+t*4;w[t]=(data[pos]<<24)|(data[pos+1]<<16)|(data[pos+2]<<8)|data[pos+3];}
    for(var t=16;t<64;t++){var s0=ro(w[t-15],7)^ro(w[t-15],18)^(w[t-15]>>>3),s1=ro(w[t-2],17)^ro(w[t-2],19)^(w[t-2]>>>10);w[t]=(w[t-16]+s0+w[t-7]+s1)|0;}
    var a=h[0],b=h[1],c=h[2],d=h[3],e=h[4],f=h[5],g=h[6],q=h[7];
    for(var t=0;t<64;t++){var one=(q+(ro(e,6)^ro(e,11)^ro(e,25))+((e&f)^(~e&g))+k[t]+w[t])|0,two=((ro(a,2)^ro(a,13)^ro(a,22))+((a&b)^(a&c)^(b&c)))|0;q=g;g=f;f=e;e=(d+one)|0;d=c;c=b;b=a;a=(one+two)|0;}
    h[0]=(h[0]+a)|0;h[1]=(h[1]+b)|0;h[2]=(h[2]+c)|0;h[3]=(h[3]+d)|0;h[4]=(h[4]+e)|0;h[5]=(h[5]+f)|0;h[6]=(h[6]+g)|0;h[7]=(h[7]+q)|0;
  }
  var result=[];for(var i=0;i<8;i++)for(var j=3;j>=0;j--)result.push((h[i]>>>j*8)&255);return result;
}

function equal_(a,b){if(typeof a!=='string'||typeof b!=='string')return false;var diff=a.length^b.length;for(var i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i%b.length);return diff===0;}

function careOrder_(o){return o.type==='care'||o.type==='upsale'||o.isCare===true;}
function weightOrder_(o){return o.isSplit===true?0.5:1;}

// A first report may start on any of the last seven completed days.
// Existing accounts must submit every day since their start (within that window).
function reportWindow_(){
 var today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 var d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-1);var to=d.toISOString().slice(0,10);d.setUTCDate(d.getUTCDate()-6);return {from:d.toISOString().slice(0,10),to:to};
}
function checkReportSequence_(accountId,date,actor,excludeId){
 if(actor.role==='admin')return; // Admin can correct historical reports; every change is audited.
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

function normalizeReportBudgets_(reports){
 const balances=Object.create(null);
 return JSON.parse(JSON.stringify(reports)).sort((a,b)=>a.date.localeCompare(b.date)).map(r=>{
  r.entries=r.entries.map(e=>{
   const key=r.accountId+'|'+e.productId;
   if(Object.prototype.hasOwnProperty.call(e,'received')){
    const received=Number(e.received);
    if(!Number.isFinite(received)||received<0||received>1e13)throw applicationError_('Tiền mới nhận phải là số không âm.');
    e.received=received;e.carryover=balances[key]||0;e.budget=e.received+e.carryover;
    if(r.status==='submitted'&&Number(e.remaining)>e.budget)throw applicationError_('Ngày '+r.date+': thừa cuối ngày vượt ngân sách sau khi chuyển dư. Kiểm tra tiền mới nhận và số dư.');
   }
   if(r.status==='submitted')balances[key]=Number(e.remaining||0);
   else if(r.postedEntries){const posted=r.postedEntries.find(x=>x.productId===e.productId);if(posted)balances[key]=Number(posted.remaining||0);}
   return e;
  });return r;
 });
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

function prepareOrder_(p,user){
    var accountId=owner_(p.accountId,user);date_(p.date);var old=p.id?get_('Orders',p.id):null;
    if(user.role==='admin'&&!old)throw applicationError_('Admin chỉ xem và sửa đơn đã có.');if(p.id&&!old)throw applicationError_('Đơn không còn tồn tại.');if(old&&user.role!=='admin'&&old.accountId!==user.id)throw applicationError_('Không có quyền sửa đơn.');
    if(old&&Number(p.revision||0)!==Number(old.revision||0))throw conflict_();
    if(!(user.role==='admin'&&old&&old.accountId===accountId&&old.productId===p.productId))checkProduct_(accountId,p.productId);var customer=String(p.customerName||'').trim();if(!customer||customer.length>200)throw applicationError_('Tên khách chưa hợp lệ.');
    if(!['sale','care','upsale'].includes(p.type))throw applicationError_('Loại doanh thu chưa hợp lệ.');
    if(p.isCare!==undefined && typeof p.isCare!=='boolean')throw applicationError_('Danh dau cham khong hop le.');
    if(p.isBounced!==undefined&&typeof p.isBounced!=='boolean')throw applicationError_('Đánh dấu bùng không hợp lệ.');if(!old&&p.isBounced)throw applicationError_('Chỉ đánh dấu bùng khi sửa đơn.');
    if(p.isSplit!==undefined && typeof p.isSplit!=='boolean')throw applicationError_('Danh dau chia khong hop le.');
    if(p.amountUsd===''||p.amountUsd===undefined||p.amountUsd===null)throw applicationError_('Nhap so tien thuc te cua don hang.');
    var usd=num_(p.amountUsd,false),rate=num_(p.rate,false);if(rate<=0)throw applicationError_('Tỷ giá phải lớn hơn 0.');
    return {id:old?old.id:newId_(),accountId:accountId,productId:p.productId,date:p.date,customerName:customer,type:p.type,isCare:p.isCare===true,isSplit:p.isSplit===true,isBounced:p.isBounced===true,amountUsd:usd,rate:rate,amountVnd:num_(Math.round(usd*rate),false),revision:(old?old.revision||0:0)+1,createdAt:old?old.createdAt:now_(),updatedAt:now_()};
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
  var a=get_('Accounts',id);if(!a||a.role!=='user'||!a.active||a.deletedAt)throw applicationError_('Nhân viên đã bị xóa, khóa hoặc không phải user. Tải lại danh sách nhân viên.');
  var candidateId=newId_(),old=existing.find(function(x){return x.accountId===id&&x.productId===productId;});
  return {id:old?old.id:candidateId,accountId:id,productId:productId,active:true,updatedAt:now_()};
 });
}
