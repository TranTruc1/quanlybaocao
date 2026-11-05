export function hasBatchData(row,kind='orders'){
 if(kind==='products')return (row.accountIds?.length||0)>0||!!String(row.name||'').trim()||(row.priceUsd!==''&&row.priceUsd!=null);
 return !!row.productId||!!String(row.customerName||'').trim()||(row.amountUsd!==''&&row.amountUsd!=null)||row.isCare===true||row.isSplit===true||!!(row.type&&row.type!=='sale');
}
export function batchPayload(rows,kind='orders'){
 return rows.filter(row=>hasBatchData(row,kind)).map(({key,...row})=>row);
}
