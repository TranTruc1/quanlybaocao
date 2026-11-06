// Bounds cover the full history, even when the loaded data window is one month.
export function latestReportDate(db,accountId){
 const bounds=(db.reportDateBounds||[]).filter(row=>!accountId||row.accountId===accountId).map(row=>row.last).filter(Boolean);
 if(bounds.length)return bounds.sort().at(-1);
 return db.reports.filter(r=>!r._carryContext&&(!accountId||r.accountId===accountId)).map(r=>r.date).sort().at(-1)||null;
}
