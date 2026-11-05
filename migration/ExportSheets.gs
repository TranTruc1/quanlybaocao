/** Paste into the OLD Apps Script project. Run xuatDuLieuSangMongoDB.
 * Creates a private JSON file in the owner's Google Drive. No sheet is changed.
 * Password hashes are included for migration; never publish/commit this file.
 * SL_AUTH_PEPPER is NOT exported. Copy it privately from Script Properties.
 */
function xuatDuLieuSangMongoDB(){
 var lock=LockService.getScriptLock();lock.waitLock(30000);
 try{
 var id=PropertiesService.getScriptProperties().getProperty('SL_SPREADSHEET_ID');
 var ss=id?SpreadsheetApp.openById(id):SpreadsheetApp.getActiveSpreadsheet();
 if(!ss)throw new Error('Không tìm thấy Google Sheet.');
 var tables={},counts={};
 ['Accounts','Products','Assignments','Reports','Orders','Targets','Audit','Notifications'].forEach(function(name){
  var sheet=ss.getSheetByName('SL_'+name);tables[name]=[];
  if(sheet&&sheet.getLastRow()>1){
   sheet.getRange(2,1,sheet.getLastRow()-1,2).getValues().forEach(function(row,i){
    if(!row[0]&&!row[1])return;
    var record;try{record=JSON.parse(row[1]);}catch(e){throw new Error('JSON lỗi: SL_'+name+' dòng '+(i+2));}
    if(!record||record.id!==String(row[0]))throw new Error('ID không khớp: SL_'+name+' dòng '+(i+2));
    tables[name].push(record);
   });
  }
  counts[name]=tables[name].length;
 });
 var contents=JSON.stringify({format:'so-lieu-export',version:1,exportedAt:new Date().toISOString(),counts:counts,tables:tables});
 var file=DriveApp.createFile(Utilities.newBlob(contents,'application/json','so-lieu-export-'+Utilities.formatDate(new Date(),'Asia/Ho_Chi_Minh','yyyyMMdd-HHmmss')+'.json'));
 Logger.log('Tải JSON tại: '+file.getUrl());Logger.log(JSON.stringify(counts));
 }finally{lock.releaseLock();}
}
