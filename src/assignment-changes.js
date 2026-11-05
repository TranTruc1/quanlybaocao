const key=(a,p)=>JSON.stringify([a,p]);
export function assignmentBase(assignments,accountId,productId){const old=assignments.find(a=>a.accountId===accountId&&a.productId===productId);return {accountId,productId,baseId:old?.id||null,baseActive:old?.active===true,baseUpdatedAt:old?.updatedAt||null};}
export function toggleAssignment(changes,assignments,accountId,productId){
 const previous=changes.find(a=>a.accountId===accountId&&a.productId===productId),base=previous||assignmentBase(assignments,accountId,productId);
 const active=!(previous?previous.active:base.baseActive),rest=changes.filter(a=>key(a.accountId,a.productId)!==key(accountId,productId));
 return active===base.baseActive?rest:[...rest,{...base,active}];
}
export function assignmentConflict(change,assignments){const now=assignmentBase(assignments,change.accountId,change.productId);return ['baseId','baseActive','baseUpdatedAt'].some(k=>now[k]!==change[k]);}
